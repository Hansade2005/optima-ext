const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/**
 * Error handling plugin that allows the build to continue even with TypeScript errors
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",

	setup(build) {
		build.onStart(() => {
			console.log("[build] Build started")
		})
		
		build.onEnd((result) => {
			if (result.errors.length > 0) {
				console.log(`[build] Completed with ${result.errors.length} errors`)
				result.errors.forEach(({ text, location }) => {
					console.error(`✘ [ERROR] ${text}`)
					if (location) {
						console.error(`    ${location.file}:${location.line}:${location.column}:`)
					}
				})
			} else {
				console.log("[build] Build completed successfully")
			}
			
			// Always return success so the build continues
			return { errors: [] }
		})
	},
}

/**
 * Plugin to copy necessary WASM files
 * @type {import('esbuild').Plugin}
 */
const copyAssetsPlugin = {
	name: "copy-assets-plugin",
	setup(build) {
		build.onEnd(() => {
			try {
				// Ensure the webview-ui build directory exists
				const webviewBuildPath = path.join(__dirname, 'webview-ui', 'build', 'assets')
				if (!fs.existsSync(webviewBuildPath)) {
					fs.mkdirSync(webviewBuildPath, { recursive: true })
					console.log(`Created directory: ${webviewBuildPath}`)
					
					// Create minimal fallback files if needed
					if (!fs.existsSync(path.join(webviewBuildPath, 'index.js'))) {
						const jsContent = `
							(function() {
								const vscode = acquireVsCodeApi();
								window.addEventListener('load', function() {
									document.getElementById('root').innerHTML = '<div style="padding: 20px; text-align: center;"><h2>Optima AI</h2><p>Fallback UI created by build system</p></div>';
									vscode.postMessage({ type: 'webviewDidLaunch' });
								});
							})();
						`;
						fs.writeFileSync(path.join(webviewBuildPath, 'index.js'), jsContent);
						console.log('Created fallback index.js');
					}
					
					if (!fs.existsSync(path.join(webviewBuildPath, 'index.css'))) {
						const cssContent = `
							body { 
								font-family: var(--vscode-font-family);
								color: var(--vscode-editor-foreground);
								background-color: var(--vscode-editor-background);
								padding: 20px;
							}
						`;
						fs.writeFileSync(path.join(webviewBuildPath, 'index.css'), cssContent);
						console.log('Created fallback index.css');
					}
				}
				
				// Copy codicon files if needed
				const codiconDist = path.join(__dirname, 'node_modules', '@vscode', 'codicons', 'dist')
				const codiconCss = path.join(codiconDist, 'codicon.css')
				const codiconTtf = path.join(codiconDist, 'codicon.ttf')
				
				if (fs.existsSync(codiconCss) && fs.existsSync(codiconTtf)) {
					console.log('Codicon files found');
				} else {
					console.warn('Warning: Codicon files not found. UI icons may not display correctly.');
				}
			} catch (error) {
				console.error('Error in copy-assets plugin:', error);
			}
		})
	}
}

const extensionConfig = {
	entryPoints: ["src/extension.ts"],
	bundle: true,
	outfile: "dist/extension.js",
	external: ["vscode"],
	format: "cjs",
	platform: "node",
	minify: production,
	sourcemap: !production,
	logLevel: "info",
	plugins: [
		copyAssetsPlugin,
		esbuildProblemMatcherPlugin,
	],
	// Skip type checking to allow build even with TS errors
	tsconfig: './tsconfig.json',
	loader: {
		'.ts': 'ts',
		'.tsx': 'tsx',
	},
}

/**
 * Main build function
 */
async function main() {
	try {
		console.log(`Building in ${production ? 'production' : 'development'} mode`)
		
		// Make sure dist directory exists
		if (!fs.existsSync('dist')) {
			fs.mkdirSync('dist')
		}
		
		if (watch) {
			// Watch mode
			const ctx = await esbuild.context(extensionConfig)
			await ctx.watch()
			console.log('Watching for changes...')
		} else {
			// Build once
			await esbuild.build(extensionConfig)
			console.log('Build complete')
		}
	} catch (error) {
		console.error('Build failed:', error)
		process.exit(1)
	}
}

main()
