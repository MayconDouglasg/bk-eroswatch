const bcrypt = require('bcryptjs');

async function generate() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    console.log('Hash para admin123:', hash);
}

generate();
