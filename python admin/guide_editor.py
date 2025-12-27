import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser, font
import json
import os
import shutil
from datetime import datetime

edit_frame = None
main_frame = None

class GuideEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Éditeur de Guide Alpha Source")
        self.root.geometry("900x650")
        
        self.uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        os.makedirs(self.uploads_dir, exist_ok=True)

        self.pages = []
        self.current_page = 0
        self.load_guide()

        self.create_widgets()

    def create_widgets(self):
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        toolbar = ttk.Frame(main_frame)
        toolbar.pack(fill=tk.X, pady=(0, 10))

        ttk.Button(toolbar, text="Nouvelle Page", command=self.new_page).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="Supprimer Page", command=self.delete_page).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="◀ Précédente", command=self.prev_page).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="Suivante ▶", command=self.next_page).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="Sauvegarder", command=self.save_guide).pack(side=tk.RIGHT, padx=5)
        ttk.Button(toolbar, text="Valider", command=self.validate_guide).pack(side=tk.RIGHT, padx=5)

        self.page_label = ttk.Label(toolbar, text="Page 1/1")
        self.page_label.pack(side=tk.RIGHT, padx=20)

        edit_frame = ttk.Frame(main_frame)
        edit_frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(edit_frame, text="Contenu:").pack(anchor=tk.W)
        
        self.text_area = tk.Text(edit_frame, wrap=tk.WORD, font=("Arial", 11), height=15)
        self.text_area.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        image_frame = ttk.LabelFrame(edit_frame, text="Image du bas", padding=10)
        image_frame.pack(fill=tk.X, pady=(10, 0))

        ttk.Label(image_frame, text="Chemin:").pack(side=tk.LEFT)
        self.image_path_var = tk.StringVar()
        ttk.Entry(image_frame, textvariable=self.image_path_var, width=60).pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        ttk.Button(image_frame, text="Choisir image", command=self.choose_image).pack(side=tk.LEFT, padx=5)
        ttk.Button(image_frame, text="Effacer", command=lambda: self.image_path_var.set('')).pack(side=tk.LEFT)

        self.update_display()

    def load_guide(self):
        try:
            with open('guide.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.pages = data.get('pages', [])
        except FileNotFoundError:
            self.pages = []
        except json.JSONDecodeError:
            messagebox.showerror("Erreur", "guide.json corrompu")
            self.pages = []

    def save_guide(self):
        content = self.text_area.get(1.0, tk.END).strip()
        image = self.image_path_var.get()
        self.pages[self.current_page] = {'content': content, 'image': image}
        
        data = {'pages': self.pages}
        with open('guide.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        messagebox.showinfo("Succès", "Guide sauvegardé!")

    def new_page(self):
        self.save_guide()
        self.pages.append({'content': '', 'image': ''})
        self.current_page = len(self.pages) - 1
        self.update_display()

    def delete_page(self):
        if len(self.pages) > 1:
            del self.pages[self.current_page]
            if self.current_page >= len(self.pages):
                self.current_page = len(self.pages) - 1
            self.save_guide()
            self.update_display()
        else:
            messagebox.showwarning("Attention", "Minimum 1 page requise")

    def prev_page(self):
        if self.current_page > 0:
            self.save_guide()
            self.current_page -= 1
            self.update_display()

    def next_page(self):
        if self.current_page < len(self.pages) - 1:
            self.save_guide()
            self.current_page += 1
            self.update_display()

    def update_display(self):
        if not self.pages:
            self.new_page()
        page = self.pages[self.current_page]
        self.text_area.delete(1.0, tk.END)
        self.text_area.insert(tk.END, page.get('content', ''))
        self.image_path_var.set(page.get('image', ''))
        self.page_label.config(text=f"Page {self.current_page + 1}/{len(self.pages)}")

    def choose_image(self):
        filename = filedialog.askopenfilename(filetypes=[("Images", "*.png *.jpg *.jpeg *.gif")])
        if filename:
            try:
                # Copier l'image dans /uploads/
                base_name = os.path.basename(filename)
                # Ajouter un timestamp pour éviter les conflits
                name_without_ext = os.path.splitext(base_name)[0]
                ext = os.path.splitext(base_name)[1]
                new_filename = f"{name_without_ext}_{int(datetime.now().timestamp())}{ext}"
                
                dest_path = os.path.join(self.uploads_dir, new_filename)
                shutil.copy2(filename, dest_path)
                
                # Stocker seulement le chemin relatif
                relative_path = f"/uploads/{new_filename}"
                self.image_path_var.set(relative_path)
                messagebox.showinfo("Succès", f"Image copiée: {relative_path}")
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur lors de la copie: {str(e)}")

    def validate_guide(self):
        self.save_guide()
        messagebox.showinfo("Validé", "Guide validé et sauvegardé!\n\nRecharger la page de connexion pour voir les changements.")

        # Zone de texte
        self.text_area = tk.Text(edit_frame, wrap=tk.WORD, font=("Arial", 12))
        self.text_area.pack(fill=tk.BOTH, expand=True)

        # Tags pour formatage
        self.text_area.tag_configure("bold", font=("Arial", 12, "bold"))
        self.text_area.tag_configure("italic", font=("Arial", 12, "italic"))

        # Frame pour l'image
        image_frame = ttk.Frame(edit_frame)
        image_frame.pack(fill=tk.X, pady=(5, 0))

        ttk.Label(image_frame, text="Image du bas:").pack(side=tk.LEFT)
        self.image_path_var = tk.StringVar()
        ttk.Entry(image_frame, textvariable=self.image_path_var, width=50).pack(side=tk.LEFT, padx=5)
        ttk.Button(image_frame, text="Choisir", command=self.choose_image).pack(side=tk.LEFT)

        # Bouton valider
        ttk.Button(main_frame, text="Valider et Implémenter", command=self.validate_guide).pack(pady=10)

        self.update_display()

    def load_guide(self):
        try:
            with open('guide.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.pages = data.get('pages', [])
        except FileNotFoundError:
            self.pages = []
        except json.JSONDecodeError:
            messagebox.showerror("Erreur", "Fichier guide.json corrompu")
            self.pages = []

    def save_guide(self):
        data = {'pages': self.pages}
        with open('guide.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        messagebox.showinfo("Sauvegardé", "Guide sauvegardé avec succès")

    def new_page(self):
        self.pages.append({'content': '', 'image': ''})
        self.current_page = len(self.pages) - 1
        self.update_display()

    def delete_page(self):
        if len(self.pages) > 1:
            del self.pages[self.current_page]
            if self.current_page >= len(self.pages):
                self.current_page = len(self.pages) - 1
            self.update_display()
        else:
            messagebox.showwarning("Attention", "Il doit y avoir au moins une page")

    def prev_page(self):
        if self.current_page > 0:
            self.save_current_page()
            self.current_page -= 1
            self.update_display()

    def next_page(self):
        if self.current_page < len(self.pages) - 1:
            self.save_current_page()
            self.current_page += 1
            self.update_display()

    def save_current_page(self):
        content = self.text_area.get(1.0, tk.END).strip()
        image = self.image_path_var.get()
        self.pages[self.current_page] = {'content': content, 'image': image}

    def update_display(self):
        if self.pages:
            page = self.pages[self.current_page]
            self.text_area.delete(1.0, tk.END)
            self.text_area.insert(tk.END, page.get('content', ''))
            self.image_path_var.set(page.get('image', ''))
            self.page_label.config(text=f"Page {self.current_page + 1}/{len(self.pages)}")
        else:
            self.new_page()

    def toggle_bold(self):
        try:
            if self.text_area.tag_ranges(tk.SEL):
                current_tags = self.text_area.tag_names(tk.SEL_FIRST)
                if "bold" in current_tags:
                    self.text_area.tag_remove("bold", tk.SEL_FIRST, tk.SEL_LAST)
                else:
                    self.text_area.tag_add("bold", tk.SEL_FIRST, tk.SEL_LAST)
        except tk.TclError:
            pass

    def toggle_italic(self):
        try:
            if self.text_area.tag_ranges(tk.SEL):
                current_tags = self.text_area.tag_names(tk.SEL_FIRST)
                if "italic" in current_tags:
                    self.text_area.tag_remove("italic", tk.SEL_FIRST, tk.SEL_LAST)
                else:
                    self.text_area.tag_add("italic", tk.SEL_FIRST, tk.SEL_LAST)
        except tk.TclError:
            pass

    def change_color(self):
        color = colorchooser.askcolor(title="Choisir une couleur")[1]
        if color:
            try:
                self.text_area.tag_add(f"color_{color}", tk.SEL_FIRST, tk.SEL_LAST)
                self.text_area.tag_configure(f"color_{color}", foreground=color)
            except tk.TclError:
                pass

    def change_font(self):
        # Simple changement de police
        font_name = tk.font.families()[0]  # Pour simplicité, utiliser la première police
        try:
            self.text_area.tag_add(f"font_{font_name}", tk.SEL_FIRST, tk.SEL_LAST)
            self.text_area.tag_configure(f"font_{font_name}", font=(font_name, 12))
        except tk.TclError:
            pass

    def add_image(self):
        # Pour simplifier, on ajoute juste le texte d'une image
        self.text_area.insert(tk.INSERT, "[IMAGE]")

    def choose_image(self):
        filename = filedialog.askopenfilename(filetypes=[("Images", "*.png *.jpg *.jpeg *.gif")])
        if filename:
            try:
                # Copier l'image dans /uploads/
                uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
                os.makedirs(uploads_dir, exist_ok=True)
                
                base_name = os.path.basename(filename)
                name_without_ext = os.path.splitext(base_name)[0]
                ext = os.path.splitext(base_name)[1]
                # Ajouter timestamp pour éviter les conflits
                new_filename = f"{name_without_ext}_{int(__import__('time').time())}{ext}"
                
                dest_path = os.path.join(uploads_dir, new_filename)
                shutil.copy2(filename, dest_path)
                
                # Stocker seulement le chemin relatif
                relative_path = f"/uploads/{new_filename}"
                self.image_path_var.set(relative_path)
                messagebox.showinfo("Succès", f"Image copiée!\n{relative_path}")
            except Exception as e:
                messagebox.showerror("Erreur", f"Erreur: {str(e)}")

    def validate_guide(self):
        self.save_current_page()
        self.save_guide()
        # Ici, on pourrait redémarrer le serveur ou notifier, mais pour l'instant juste sauvegarder
        messagebox.showinfo("Validé", "Guide validé et implémenté sur le site")

if __name__ == "__main__":
    root = tk.Tk()
    app = GuideEditor(root)
    root.mainloop()