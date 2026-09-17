import { parentPort } from 'node:worker_threads';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();
parentPort.on('message', async graph => {
  try { parentPort.postMessage({ graph: await elk.layout(graph) }); }
  catch (error) { parentPort.postMessage({ error: error.message }); }
});
