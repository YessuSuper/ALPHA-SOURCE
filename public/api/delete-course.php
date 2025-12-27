<?php
session_start();

header('Content-Type: application/json');

$id = $_GET['id'] ?? null;
if (!$id) {
    http_response_code(400);
    echo json_encode(["message" => "ID manquant"]);
    exit;
}

$jsonFile = __DIR__ . '/courses.json';
$data = file_exists($jsonFile) ? json_decode(file_get_contents($jsonFile), true) : [];

$original = null;

foreach ($data as $entry) {
    if ($entry["id"] === $id && empty($entry["deleted"])) {
        $original = $entry;
        break;
    }
}

if (!$original) {
    http_response_code(404);
    echo json_encode(["message" => "Cours introuvable"]);
    exit;
}

// Vérifier l’auteur
if ($original["username"] !== $_SESSION["username"]) {
    http_response_code(403);
    echo json_encode(["message" => "Vous ne pouvez pas supprimer ce cours"]);
    exit;
}

// Vérifier la limite de 120 secondes
$elapsed = time() - $original["upload_time"];
if ($elapsed > 120) {
    http_response_code(403);
    echo json_encode(["message" => "Délai dépassé"]);
    exit;
}

// Ajouter la version supprimée
$data[] = [
    "id" => $id,
    "deleted" => true,
    "deleted_at" => time(),
    "deleted_by" => $_SESSION["username"]
];

file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT));

echo json_encode(["message" => "Cours supprimé"]);
