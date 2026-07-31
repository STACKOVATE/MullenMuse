const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('后端跑通了！'));
app.listen(3000, () => console.log('跑在 http://localhost:3000'));