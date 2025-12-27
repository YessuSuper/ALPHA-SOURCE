import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import json
import os
from datetime import datetime
import threading
import time
import bcrypt

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_PATH = os.path.join(BASE_DIR, 'public', 'api', 'users.json')
COURS_PATH = os.path.join(BASE_DIR, 'public', 'api', 'cours.json')
COMMUNITY_DIR = os.path.join(BASE_DIR, 'public', 'api', 'community')
MESSAGES_PATH = os.path.join(BASE_DIR, 'public', 'api', 'messagerie', 'messages.json')

class PanelApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Panel de Commande 🗿")
        self.root.geometry("800x600")

        # Date/Time label
        self.time_label = tk.Label(root, font=('Arial', 12))
        self.time_label.pack(pady=10)
        self.update_time()

        # Dropdown for tabs
        self.tab_var = tk.StringVar(value="utilisateurs")
        self.tab_menu = ttk.Combobox(root, textvariable=self.tab_var, values=["utilisateurs", "ia", "cours", "communaute", "messagerie", "stats", "commandes", "autre"])
        self.tab_menu.pack(pady=10)
        self.tab_menu.bind("<<ComboboxSelected>>", self.on_tab_change)

        # Content frame
        self.content_frame = tk.Frame(root)
        self.content_frame.pack(fill=tk.BOTH, expand=True)

        # Secondary window button
        self.secondary_btn = tk.Button(root, text="Ouvrir Fenêtre Secondaire", command=self.open_secondary)
        self.secondary_btn.pack(pady=10)

        self.on_tab_change()

    def update_time(self):
        now = datetime.now()
        # Format : Samedi 20 Décembre 2025
        self.time_label.config(text=now.strftime("%A %d %B %Y - %H:%M:%S"))
        self.root.after(1000, self.update_time)

    def on_tab_change(self, event=None):
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        tab = self.tab_var.get()
        if tab == "utilisateurs":
            self.show_utilisateurs()
        elif tab == "ia":
            self.show_ia()
        elif tab == "cours":
            self.show_cours()
        elif tab == "communaute":
            self.show_communaute()
        elif tab == "messagerie":
            self.show_messagerie()
        else:
            tk.Label(self.content_frame, text=f"{tab.capitalize()} - Vide 🗿").pack()

    def show_utilisateurs(self):
        try:
            with open(USERS_PATH, 'r', encoding='utf-8') as f:
                users = json.load(f)
        except:
            users = []

        # En-tête rapide
        active_count = sum(1 for u in users if u.get('active', False))
        tk.Label(self.content_frame, text=f"Utilisateurs actifs: {active_count}", font=('Arial', 10, 'bold')).pack()

        # --- SYSTÈME DE DÉFILEMENT (Canvas + Scrollbar) ---
        container = tk.Frame(self.content_frame)
        container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        canvas = tk.Canvas(container)
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Remplissage de la liste avec tes cases à cocher
        self.user_vars = {}
        for user in users:
            f = tk.Frame(scrollable_frame)
            f.pack(fill=tk.X, expand=True, pady=2)
            
            # Nom de l'utilisateur
            tk.Label(f, text=user['username'], width=20, anchor="w").pack(side=tk.LEFT)
            
            # Case à cocher pour le ban
            var = tk.BooleanVar(value=user.get('banned', False))
            self.user_vars[user['username']] = var
            cb = tk.Checkbutton(f, text="Banni", variable=var, command=lambda u=user: self.toggle_ban(u))
            cb.pack(side=tk.RIGHT)

        # Boutons d'action en bas
        btn_frame = tk.Frame(self.content_frame)
        btn_frame.pack(pady=10)
        tk.Button(btn_frame, text="Créer Utilisateur", command=self.create_user).pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="Supprimer Utilisateur", command=self.delete_user).pack(side=tk.LEFT, padx=5)

    def toggle_ban(self, user):
        var = self.user_vars[user['username']]
        user['banned'] = var.get()
        try:
            with open(USERS_PATH, 'r', encoding='utf-8') as f:
                users = json.load(f)
            for u in users:
                if u['username'] == user['username']:
                    u['banned'] = user['banned']
                    break
            with open(USERS_PATH, 'w', encoding='utf-8') as f:
                json.dump(users, f, indent=2)
        except Exception as e:
            messagebox.showerror("Erreur", f"T'as encore cassé le JSON : {e} 🗿")

    def create_user(self):
        username = simpledialog.askstring("Créer", "Nom d'utilisateur:")
        if not username: return
        password = simpledialog.askstring("Créer", "Mot de passe:", show='*')
        if not password: return
        
        try:
            with open(USERS_PATH, 'r', encoding='utf-8') as f: users = json.load(f)
        except: users = []

        if any(u['username'].lower() == username.lower() for u in users):
            messagebox.showerror("Erreur", "Déjà là lui 🗿")
            return

        salt = bcrypt.gensalt()
        hash_pw = bcrypt.hashpw(password.encode(), salt).decode()
        users.append({
            "username": username, "passwordHash": hash_pw, "pt": 0,
            "connexions": 0, "last_connexion": None, "active": False, "banned": False
        })
        with open(USERS_PATH, 'w', encoding='utf-8') as f: json.dump(users, f, indent=2)
        self.on_tab_change()

    def delete_user(self):
        username = simpledialog.askstring("Supprimer", "Nom d'utilisateur:")
        if not username: return
        try:
            with open(USERS_PATH, 'r', encoding='utf-8') as f: users = json.load(f)
            users = [u for u in users if u['username'].lower() != username.lower()]
            with open(USERS_PATH, 'w', encoding='utf-8') as f: json.dump(users, f, indent=2)
            self.on_tab_change()
        except: pass

    def show_ia(self): tk.Label(self.content_frame, text="IA - Vide 🗿").pack()
    def show_cours(self): tk.Label(self.content_frame, text="Cours - Vide 🗿").pack()
    def show_communaute(self): tk.Label(self.content_frame, text="Communauté - Vide 🗿").pack()
    def show_messagerie(self): tk.Label(self.content_frame, text="Messagerie - Vide 🗿").pack()

    def open_secondary(self):
        secondary = tk.Toplevel(self.root)
        secondary.title("Fenêtre Secondaire 🗿")
        secondary.geometry("400x400")
        for s in ["Hiver", "Printemps", "Été", "Automne", "Noël", "Pâques"]:
            tk.Button(secondary, text=s).pack(pady=2)

if __name__ == "__main__":
    root = tk.Tk()
    app = PanelApp(root)
    root.mainloop()