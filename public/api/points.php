<?php
header('Content-Type: application/json; charset=utf-8');
$file = __DIR__ . '/points.json';

function respond($data){
    echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
    exit;
}

if (!file_exists($file)) {
    file_put_contents($file, json_encode(["version"=>1, "users"=>[]], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $content = @file_get_contents($file);
    if ($content === false) respond(["ok"=>false, "error"=>"cannot read file"]);
    $decoded = json_decode($content, true);
    respond($decoded !== null ? $decoded : ["version"=>1, "users"=>[]]);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;
if (!$input) $input = [];

$action = isset($input['action']) ? $input['action'] : (isset($_GET['action']) ? $_GET['action'] : 'get');
$userId = isset($input['userId']) ? (string)$input['userId'] : (isset($_GET['userId']) ? (string)$_GET['userId'] : null);

// safe lock/read/write helper
function load_data($file){
    $f = fopen($file, 'c+');
    if (!$f) return null;
    flock($f, LOCK_EX);
    $size = filesize($file);
    $raw = $size ? fread($f, $size) : '';
    $data = $raw ? json_decode($raw, true) : null;
    if ($data === null) $data = ["version"=>1, "users"=>[]];
    return [$f, $data];
}

function save_data($f, $data, $file){
    ftruncate($f, 0);
    rewind($f);
    fwrite($f, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    fflush($f);
    flock($f, LOCK_UN);
    fclose($f);
}

if ($method === 'POST') {
    $res = load_data($file);
    if ($res === null) respond(["ok"=>false, "error"=>"cannot open data file"]);
    list($f, $data) = $res;
    if (!isset($data['users'])) $data['users'] = [];

    // ensure user entry
    if ($userId !== null) {
        if (!isset($data['users'][$userId])) {
            $data['users'][$userId] = [
                'points' => 0,
                'messages_total' => 0,
                'messages_in_group' => 0,
                'messages_sourceai' => 0,
                'courses_uploaded' => 0,
                'logins_count' => 0,
                'awards' => [
                    'p100' => false
                ]
            ];
        }
    }

    $user = null;
    if ($userId !== null && isset($data['users'][$userId])) {
        $user =& $data['users'][$userId];
    }

    switch ($action) {
        case 'recordMessage':
            // expects: userId, content, target ('group'|'fill'|'sourceai'|'other')
            if (!$user) { 
                save_data($f,$data,$file); 
                respond(["ok"=>false, "error"=>"userId required"]); 
            }
            $content = isset($input['content']) ? trim($input['content']) : '';
            $target = isset($input['target']) ? $input['target'] : 'other';
            $len = mb_strlen($content);
            $prev_total = $user['messages_total'];
            
            if ($len > 5) {
                $user['messages_total'] = $prev_total + 1;
                
                // group or fill
                if ($target === 'group' || $target === 'fill') {
                    $prev = $user['messages_in_group'];
                    $user['messages_in_group'] = $prev + 1;
                    $award_prev = intdiv($prev, 20);
                    $award_new = intdiv($user['messages_in_group'], 20);
                    $delta = $award_new - $award_prev;
                    if ($delta > 0) $user['points'] += $delta * 1; // +1 per 20
                }
                
                // source AI
                if ($target === 'sourceai') {
                    $prev = $user['messages_sourceai'];
                    $user['messages_sourceai'] = $prev + 1;
                    $award_prev = intdiv($prev, 10);
                    $award_new = intdiv($user['messages_sourceai'], 10);
                    $delta = $award_new - $award_prev;
                    if ($delta > 0) $user['points'] += $delta * 1; // +1 per 10
                }

                // palier 100 messages total -> +10 once
                if (!$user['awards']['p100'] && $prev_total < 100 && $user['messages_total'] >= 100) {
                    $user['points'] += 10;
                    $user['awards']['p100'] = true;
                }
            }
            
            save_data($f, $data, $file);
            respond(["ok"=>true, "user"=> $user]);
            break;

        case 'recordCourseUpload':
            if (!$user) { 
                save_data($f,$data,$file); 
                respond(["ok"=>false, "error"=>"userId required"]); 
            }
            $user['courses_uploaded'] = $user['courses_uploaded'] + 1;
            $user['points'] += 10;
            save_data($f, $data, $file);
            respond(["ok"=>true, "user"=> $user]);
            break;

        case 'recordLogin':
            if (!$user) { 
                save_data($f,$data,$file); 
                respond(["ok"=>false, "error"=>"userId required"]); 
            }
            $prev = $user['logins_count'];
            $user['logins_count'] = $prev + 1;
            $award_prev = intdiv($prev, 5);
            $award_new = intdiv($user['logins_count'], 5);
            $delta = $award_new - $award_prev;
            if ($delta > 0) $user['points'] += $delta * 1; // +1 per 5 logins
            save_data($f, $data, $file);
            respond(["ok"=>true, "user"=> $user]);
            break;

        case 'addPoints':
            if (!$user) { 
                save_data($f,$data,$file); 
                respond(["ok"=>false, "error"=>"userId required"]); 
            }
            $amount = isset($input['amount']) ? (int)$input['amount'] : 0;
            $user['points'] += $amount;
            save_data($f, $data, $file);
            respond(["ok"=>true, "user"=> $user]);
            break;

        case 'subtractPoints':
            if (!$user) { 
                save_data($f,$data,$file); 
                respond(["ok"=>false, "error"=>"userId required"]); 
            }
            $amount = isset($input['amount']) ? (int)$input['amount'] : 0;
            $user['points'] -= $amount;
            if ($user['points'] < 0) $user['points'] = 0;
            save_data($f, $data, $file);
            respond(["ok"=>true, "user"=> $user]);
            break;

        case 'resetAll':
            // reset points and counters for all users
            foreach ($data['users'] as $uid => $u) {
                $data['users'][$uid] = [
                    'points' => 0,
                    'messages_total' => 0,
                    'messages_in_group' => 0,
                    'messages_sourceai' => 0,
                    'courses_uploaded' => 0,
                    'logins_count' => 0,
                    'awards' => ['p100' => false]
                ];
            }
            save_data($f, $data, $file);
            respond(["ok"=>true, "msg"=>"all reset"]);
            break;

        case 'get':
        default:
            save_data($f, $data, $file);
            respond(["ok"=>true, "data"=> $data]);
            break;
    }
}

// Fallback: not allowed method
http_response_code(405);
respond(["ok"=>false, "error"=>"method not allowed"]);
?>