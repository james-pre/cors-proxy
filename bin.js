#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import handleRequest from './index.js';

const temp = tmpdir();

const {
	positionals: [cmd],
	values: { port, help, pid: pidFile },
} = parseArgs({
	options: {
		help: { type: 'boolean', short: 'h', default: false },
		port: { type: 'string', short: 'p', default: '9999' },
		pid: { type: 'string', default: join(temp, 'cors-proxy.pid') },
	},
	allowPositionals: true,
});

if (cmd == 'help' || help || !cmd) {
	console.log(`Usage: ${process.argv0} [...options] <command>

Commands:
    run                 Run the CORS proxy server in the foreground
    start               Start the CORS proxy server daemon
    stop                Stop the CORS proxy server daemon

Options:
    -h, --help          Show this help message
    -p, --port <port>   Port to listen on (default: 9999)
    --pid <path>        Path to PID file (default: ${join(temp, 'cors-proxy.pid')}
`);
}

switch (cmd) {
	case 'run': {
		const server = createServer(handleRequest);
		server.listen(port, () => console.log('Listening on port', port));
		process.on('exit', () => {
			console.log('Shutting down server');
			server.close();
		});
		break;
	}

	case 'start': {
		if (existsSync(pidFile)) {
			let pid;
			try {
				pid = parseInt(readFileSync(pidFile, 'utf8'));
			} catch (e) {
				console.error('Found existing PID file but could not read it');
				process.exit(13);
			}

			try {
				process.kill(pid, 0);
			} catch {
				console.error(`Server is already running (pid is ${pid})`);
				process.exit(16);
			}

			console.error('Removing stale PID file');
			unlinkSync(pidFile);
		}

		const daemon = spawn(
			process.execPath,
			['run', port && `--port=${port}`].filter((a) => a),
			{
				stdio: 'ignore',
				detached: true,
			},
		);
		daemon.unref();
		console.log('Started CORS proxy server with PID', daemon.pid);
		writeFileSync(pidFile, daemon.pid.toString());
		process.exit(0);
	}
	case 'stop':
		try {
			const pid = parseInt(readFileSync(pidFile, 'utf8'));
			process.kill(pid);
		} catch (e) {
			console.error('Invalid or missing PID file');
		}
}
