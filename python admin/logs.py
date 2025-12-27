#!/usr/bin/env python3
# logs.py - Gestionnaire de logs pour le serveur
import json
import os
from datetime import datetime
from pathlib import Path

# Chemin du fichier logs
LOGS_PATH = Path(__file__).parent / "logs.json"

def load_logs():
    """Charge les logs depuis logs.json"""
    if not LOGS_PATH.exists():
        return {"logs": []}
    try:
        with open(LOGS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        print("Erreur: logs.json corrompu, création d'un nouveau fichier")
        return {"logs": []}

def save_logs(data):
    """Sauvegarde les logs dans logs.json"""
    with open(LOGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def add_log(level, message, source="server"):
    """Ajoute un log au fichier"""
    data = load_logs()
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "message": message,
        "source": source
    }
    data["logs"].append(log_entry)
    save_logs(data)

def display_logs(limit=None, level=None, source=None):
    """Affiche les logs de manière agréable"""
    data = load_logs()
    logs = data["logs"]

    # Filtrer
    if level:
        logs = [log for log in logs if log.get("level") == level]
    if source:
        logs = [log for log in logs if log.get("source") == source]

    # Trier par timestamp (plus récent en premier)
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # Limiter
    if limit:
        logs = logs[:limit]

    if not logs:
        print("Aucun log trouvé.")
        return

    print(f"=== LOGS ({len(logs)} entrées) ===")
    for log in logs:
        timestamp = log.get("timestamp", "N/A")
        level = log.get("level", "unknown").upper()
        message = log.get("message", "")
        source = log.get("source", "unknown")

        # Formater la date
        try:
            dt = datetime.fromisoformat(timestamp)
            date_str = dt.strftime("%Y-%m-%d %H:%M:%S")
        except:
            date_str = timestamp

        # Couleur selon le level
        if level == "ERROR":
            color = "\033[91m"  # Rouge
        elif level == "WARN":
            color = "\033[93m"  # Jaune
        elif level == "INFO":
            color = "\033[92m"  # Vert
        else:
            color = "\033[94m"  # Bleu

        print(f"{color}[{date_str}] [{level}] [{source}] {message}\033[0m")

def delete_logs_before(date_str):
    """Supprime les logs avant une date (format YYYY-MM-DD)"""
    data = load_logs()
    try:
        cutoff = datetime.fromisoformat(date_str + "T00:00:00")
        original_count = len(data["logs"])
        data["logs"] = [log for log in data["logs"] if datetime.fromisoformat(log.get("timestamp", "")) >= cutoff]
        save_logs(data)
        print(f"Supprimé {original_count - len(data['logs'])} logs avant {date_str}")
    except ValueError:
        print("Format de date invalide. Utilisez YYYY-MM-DD")

def delete_logs_by_level(level):
    """Supprime les logs d'un certain level"""
    data = load_logs()
    original_count = len(data["logs"])
    data["logs"] = [log for log in data["logs"] if log.get("level") != level]
    save_logs(data)
    print(f"Supprimé {original_count - len(data['logs'])} logs de level '{level}'")

def clear_all_logs():
    """Supprime tous les logs"""
    confirm = input("Êtes-vous sûr de vouloir supprimer TOUS les logs ? (oui/non): ")
    if confirm.lower() == "oui":
        save_logs({"logs": []})
        print("Tous les logs ont été supprimés.")
    else:
        print("Annulé.")

def main():
    """Interface en ligne de commande"""
    print("=== GESTIONNAIRE DE LOGS ===")
    print("Commandes disponibles:")
    print("1. Afficher tous les logs")
    print("2. Afficher les derniers N logs")
    print("3. Afficher les logs par level (error/warn/info/debug)")
    print("4. Afficher les logs par source")
    print("5. Supprimer les logs avant une date (YYYY-MM-DD)")
    print("6. Supprimer les logs d'un level")
    print("7. Supprimer tous les logs")
    print("8. Quitter")

    while True:
        try:
            choice = input("\nChoix (1-8): ").strip()

            if choice == "1":
                display_logs()
            elif choice == "2":
                limit = int(input("Nombre de logs à afficher: "))
                display_logs(limit=limit)
            elif choice == "3":
                level = input("Level (error/warn/info/debug): ").strip().lower()
                display_logs(level=level)
            elif choice == "4":
                source = input("Source: ").strip()
                display_logs(source=source)
            elif choice == "5":
                date = input("Date (YYYY-MM-DD): ").strip()
                delete_logs_before(date)
            elif choice == "6":
                level = input("Level à supprimer: ").strip().lower()
                delete_logs_by_level(level)
            elif choice == "7":
                clear_all_logs()
            elif choice == "8":
                print("Au revoir!")
                break
            else:
                print("Choix invalide.")
        except KeyboardInterrupt:
            print("\nAu revoir!")
            break
        except Exception as e:
            print(f"Erreur: {e}")

if __name__ == "__main__":
    main()