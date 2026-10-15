const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`Short URL API listening on port ${port}`);
});
