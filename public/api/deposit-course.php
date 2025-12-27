<?php
session_start(); // pour récupérer le username

header('Content-Type: application/json');

if (!isset($_SESSION["username"])) {
    http_response_code(401);
    echo json_encode(["message" => "Vous devez être connecté."]);
    exit;
}

$jsonFile = __DIR__ . '/courses.json';
$data = file_exists($jsonFile) ? json_decode(file_get_contents($jsonFile), true) : [];

$id = bin2hex(random_bytes(4)); // ID unique
$time = time();

// upload fichier
if (!isset($_FILES['course-file'])) {
    http_response_code(400);
    echo json_encode(["message" => "Fichier manquant"]);
    exit;
}

$uploadFolder = __DIR__ . '/../uploads/';
if (!is_dir($uploadFolder)) mkdir($uploadFolder, 0777, true);

$ext = pathinfo($_FILES['course-file']['name'], PATHINFO_EXTENSION);
$filename = $id . "." . $ext;

move_uploaded_file($_FILES['course-file']['tmp_name'], $uploadFolder . $filename);

// nouvelle entrée JSON
$data[] = [
    "id" => $id,
    "title" => $_POST['title'],
    "description" => $_POST['description'],
    "subject" => $_POST['subject'],
    "filepath" => "/uploads/" . $filename,
    "username" => $_SESSION["username"],
    "upload_time" => $time,
    "deleted" => false
];

file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT));

echo json_encode(["message" => "Cours ajouté avec succès", "id" => $id]);
