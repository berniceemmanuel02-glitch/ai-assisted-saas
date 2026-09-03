const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "backend", "data");
const BACKUP_DIR = path.join(__dirname, "..", "backups");
const IMPORTANT_FILES = [
  "users.json",
  "schools.json",
  "students.json",
  "fee-structures.json",
  "payments.json",
  "parent-students.json",
  "subscriptions.json",
  "invoices.json",
  "usage.json",
];

function createBackup() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      throw new Error(`Data directory not found: ${DATA_DIR}`);
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `data_${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    let backedUpCount = 0;
    for (const file of IMPORTANT_FILES) {
      const sourcePath = path.join(DATA_DIR, file);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(backupPath, file));
        backedUpCount++;
      }
    }

    if (backedUpCount === 0) {
      throw new Error("No data files found to back up");
    }

    console.log(`Backup created: ${backupPath} (${backedUpCount} files)`);

    const backups = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("data_"));
    if (backups.length > 30) {
      backups.sort();
      const toRemove = backups.slice(0, backups.length - 30);
      for (const old of toRemove) {
        const oldPath = path.join(BACKUP_DIR, old);
        fs.rmSync(oldPath, { recursive: true, force: true });
        console.log(`Removed old backup: ${oldPath}`);
      }
    }

    return { success: true, path: backupPath, files: backedUpCount };
  } catch (error) {
    console.error("Backup failed:", error.message);
    return { success: false, error: error.message };
  }
}

const result = createBackup();
if (!result.success) {
  process.exit(1);
}
