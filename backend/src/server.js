const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`ZipLink API listening on port ${port}`);
});
