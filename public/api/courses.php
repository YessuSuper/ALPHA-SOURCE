<?php
header('Content-Type: application/json');

$jsonFile = __DIR__ . '/courses.json';

if (!file_exists($jsonFile)) {
    echo json_encode([]);
    exit;
}

$data = json_decode(file_get_contents($jsonFile), true);
if (!is_array($data)) $data = [];

// Regroupe par ID pour voir si une version supprimée existe
$byId = [];

foreach ($data as $entry) {
    $id = $entry['id'];
    if (!isset($byId[$id])) $byId[$id] = [];
    $byId[$id][] = $entry;
}

$result = [];

foreach ($byId as $id => $versions) {
    $hasDeleted = false;
    $course = null;

    foreach ($versions as $v) {
        if (!empty($v['deleted'])) {
            $hasDeleted = true;
        } else {
            $course = $v;
        }
    }

    if (!$hasDeleted && $course !== null) {
        $result[] = $course;
    }
}

echo json_encode($result);
