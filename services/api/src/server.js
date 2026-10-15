const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`ZipLink API service listening on port ${port}`);
});
