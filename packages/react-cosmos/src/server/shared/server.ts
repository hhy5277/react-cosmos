import { join, relative } from 'path';
import { createServer as createHttpServer } from 'http';
import promisify from 'util.promisify';
import express from 'express';
import { PlaygroundConfig } from 'react-cosmos-playground2';
// IDEA: Maybe replace react-dev-utils with https://github.com/yyx990803/launch-editor
import launchEditor from 'react-dev-utils/launchEditor';
import { CosmosConfig } from '../shared/config';
import { getPlaygroundHtml, getPlaygroundHtmlNext } from './playground-html';
import { setupHttpProxy } from './http-proxy';
import { getPlaygroundConfig } from './config-next';

export function createServerApp({
  cosmosConfig,
  playgroundOpts
}: {
  cosmosConfig: CosmosConfig;
  playgroundOpts: PlaygroundConfig;
}) {
  const { httpProxy } = cosmosConfig;
  const app = express();

  if (httpProxy) {
    setupHttpProxy(app, httpProxy);
  }

  const playgroundHtml = getPlaygroundHtmlNext(
    getPlaygroundConfig({
      playgroundOpts,
      devServerOn: true
    })
  );
  app.get('/', (req: express.Request, res: express.Response) => {
    res.send(playgroundHtml);
  });

  app.get('/_playground.js', (req: express.Request, res: express.Response) => {
    res.sendFile(require.resolve('react-cosmos-playground2'));
  });

  app.get('/_cosmos.ico', (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, 'static/favicon.ico'));
  });

  return app;
}

export function createServer(
  cosmosConfig: CosmosConfig,
  app: express.Application
) {
  const { port, hostname } = cosmosConfig;
  const server = createHttpServer(app);

  async function startServer() {
    const listen = promisify(server.listen.bind(server));
    await listen(port, hostname);

    const hostnameDisplay = hostname || 'localhost';
    console.log(`[Cosmos] See you at http://${hostnameDisplay}:${port}`);
  }

  async function stopServer() {
    await promisify(server.close.bind(server))();
  }

  return { server, startServer, stopServer };
}

export function serveStaticDir(
  app: express.Application,
  publicUrl: string,
  publicPath: string
) {
  const relPublicPath = relative(process.cwd(), publicPath);
  console.log(`[Cosmos] Serving static files from ${relPublicPath}`);

  app.use(
    getRootUrl(publicUrl),
    express.static(publicPath, {
      // Ensure loader index (generated by html-webpack-plugin) loads instead
      // of the index.html from publicPath
      index: false
    })
  );
}

export function attachStackFrameEditorLauncher(app: express.Application) {
  app.get(
    '/__open-stack-frame-in-editor',
    (req: express.Request, res: express.Response) => {
      const lineNumber = parseInt(req.query.lineNumber, 10) || 1;
      const colNumber = parseInt(req.query.colNumber, 10) || 1;
      launchEditor(req.query.fileName, lineNumber, colNumber);
      res.end();
    }
  );
}

export function getRootUrl(publicUrl: string) {
  // To enable deploying static exports running from inside a nested path,
  // publicUrl can be set to `./`.
  // (See https://github.com/react-cosmos/react-cosmos/issues/777)
  // But publicUrl is used in for some paths which must begin with `/`:
  // - As publicPath in webpack-dev-middleware
  // - As the Express path for serving static assets
  // These are server-side modules (running in dev server mode) that only
  // respond to incoming paths which begin with the root URL we specify.
  return publicUrl === './' ? '/' : publicUrl;
}