const fs = require('fs');
const path = require('path');

const files = [
    'BioMixer_Full_Context.txt',
    'DEPLOY.md',
    'SETUP.md',
    'NEXT_STEPS.txt',
    'cookie.txt',
    'temp_passport.js',
    'アプリケーション概要.txt',
    '進捗報告_20251214.txt',
    'biomixer.sqbpro'
];

files.forEach(file => {
    try {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted: ${file}`);
        } else {
            console.log(`Not found: ${file}`);
        }
    } catch (err) {
        console.error(`Error deleting ${file}: ${err.message}`);
    }
});
