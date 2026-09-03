# Scholapay Backup and Restore Documentation

## Storage Overview

Scholapay stores all data in JSON files under `backend/data/`. This includes:
- `users.json` - User accounts and credentials
- `schools.json` - School records
- `students.json` - Student records
- `fee-structures.json` - Fee definitions
- `payments.json` - Payment transactions
- `parent-students.json` - Parent-student links
- `subscriptions.json` - Subscription records
- `invoices.json` - Invoice records
- `usage.json` - Feature usage tracking
- `products.json`, `customers.json`, `sales.json`, `sales-invoices.json` - Legacy sales data

## Backup Script

The backup script is located at `scripts/backup.js`.

### Run a Backup

```bash
node scripts/backup.js
```

This creates a timestamped directory under `backups/` containing the important JSON data files required to restore Scholapay.

### What the Script Does

1. Creates a timestamped backup directory under `backups/`
2. Copies the important data files from `backend/data/` to the backup directory
3. Retains the 30 most recent backups
4. Does not modify any production data
5. Fails clearly if a backup cannot be completed

### Scheduled Backups

This script does not include a scheduler. You must configure scheduling yourself.

#### Linux/Mac (cron)

```bash
0 2 * * * /usr/bin/node /path/to/scholapay/scripts/backup.js
```

#### Windows (Task Scheduler)

- Create a task that runs daily at 02:00
- Action: Start a program
- Program: `node`
- Arguments: `C:\path\to\scholapay\scripts\backup.js`

## Retention Policy

- Keep daily backups for 30 days
- Keep weekly backups for 12 weeks
- Keep monthly backups for 12 months

## Secure Storage

1. **Encryption**: Encrypt backups before storing offsite:
   ```bash
   # Linux/Mac with GPG
   gpg --symmetric --cipher-algo AES256 backups/data_*.tar.gz
   ```

2. **Offsite Storage**: Upload encrypted backups to:
   - AWS S3 / Google Cloud Storage / Azure Blob
   - Secure FTP server
   - Encrypted external drive

3. **Access Control**: Restrict backup access to authorized personnel only.

## Restore Procedure

1. Stop the server:
   ```bash
   taskkill /F /IM node.exe
   ```

2. Back up current data (just in case):
   ```bash
   xcopy backend\data\ emergency_backup\ /E /I /H
   ```

3. Clear current data:
   ```bash
   del /Q backend\data\*.json
   ```

4. Restore from backup:
   ```bash
   xcopy backups\data_YYYYMMDD_HHMMSS\*.json backend\data\ /E /I /H
   ```

5. Verify restored data:
   ```bash
   node -e "const fs = require('fs'); const path = require('path'); const dir = 'backend/data'; fs.readdirSync(dir).forEach(f => { if (f.endsWith('.json')) { const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); console.log(f + ': ' + (Array.isArray(data) ? data.length + ' records' : 'valid')); } });"
   ```

6. Restart the server:
   ```bash
   node backend/server.js
   ```

## Financial Record Protection

- Payment records (`payments.json`) must be included in every backup
- Never delete or modify payment records without a documented reason
- Maintain an immutable audit trail of all payment changes
- Backups of `payments.json` should be retained for a minimum of 7 years for financial compliance

## Disaster Recovery

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 24 hours (with daily backups)
- Test restore procedures quarterly
- Document any restore incidents and update procedures accordingly
