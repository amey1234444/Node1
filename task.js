const fs = require('fs');
const path = require('path');

// Task function
async function task(user_id) {
    const log = `${user_id} - task completed at ${Date.now()}\n`;
    fs.appendFileSync(path.join(__dirname, 'task_log.txt'), log);
    console.log(log);
}

module.exports = { task };
