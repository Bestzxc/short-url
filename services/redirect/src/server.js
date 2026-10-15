const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`ZipLink redirect service listening on port ${port}`);
});
