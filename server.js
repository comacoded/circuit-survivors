const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from root (index.html, style.css, src/, assets/)
app.use(express.static(path.join(__dirname), {
  setHeaders(res, filePath) {
    // Proper MIME for JS modules
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  },
}));

app.listen(PORT, () => {
  console.log(`Circuit Survivors running on port ${PORT}`);
});
