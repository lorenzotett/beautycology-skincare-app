#!/bin/bash
set -e

# Repo sorgente (GitHub originale)
SOURCE_REPO="https://github.com/dermasenseai/beautycology-skincare-app.git"

# Tuo repo GitHub per copia completa (already configured as origin)
TARGET_REPO="https://github.com/lorenzotett/beautycology-skincare-app.git"

# Branch principale
BRANCH="main"

# Cartella temporanea
WORKDIR="$HOME/complete-import"

echo "1) Creo cartella di lavoro: $WORKDIR"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

echo "2) Clono la repo sorgente..."
git clone "$SOURCE_REPO" source-repo

echo "3) Backup del contenuto attuale..."
# Backup the current webapp content
cp -r /home/user/webapp backup-current-webapp

echo "4) Copio tutto dalla repo sorgente alla webapp directory..."
cd source-repo
# Remove existing content except .git directory and import-repo.sh
find /home/user/webapp -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'import-repo.sh' -exec rm -rf {} +
# Copy all files and directories except .git
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec cp -r {} /home/user/webapp/ \;

echo "5) Torno alla directory webapp e committo..."
cd /home/user/webapp
git add .
git commit -m "Import completo: beautycology-skincare-app" || echo "Nessuna modifica da committare"
git push origin "$BRANCH"

echo "✅ Repo pronta! Ora puoi collegarla al tuo server Cloud per deploy completo backend + frontend."
echo "📁 Backup del contenuto precedente salvato in: $WORKDIR/backup-current-webapp"