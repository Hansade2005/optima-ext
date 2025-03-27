import * as vscode from 'vscode';
import { OptimaProvider } from '../core/providers/optima';
import { getNonce } from '../utilities';

export class AccountWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'roo-cline.AccountProvider';

    private _view?: vscode.WebviewView;
    private _optimaProvider: OptimaProvider;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._optimaProvider = new OptimaProvider();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'getAccountData':
                    try {
                        const session = await vscode.authentication.getSession('github', ['read:user', 'user:email'], {
                            createIfNone: true,
                        });

                        if (!session) {
                            webviewView.webview.postMessage({
                                error: 'GitHub authentication required'
                            });
                            return;
                        }

                        const subscriptionStatus = await this._optimaProvider.checkSubscriptionStatus();
                        webviewView.webview.postMessage({
                            subscriptionStatus,
                            githubProfile: {
                                label: session.account.label,
                                email: session.account.email
                            }
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            error: error instanceof Error ? error.message : 'Failed to get account data'
                        });
                    }
                    break;

                case 'githubLogin':
                    try {
                        const session = await vscode.authentication.getSession('github', ['read:user', 'user:email'], {
                            createIfNone: true,
                        });

                        if (!session) {
                            webviewView.webview.postMessage({
                                error: 'GitHub authentication failed'
                            });
                            return;
                        }

                        webviewView.webview.postMessage({
                            profile: {
                                label: session.account.label,
                                email: session.account.email
                            }
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            error: error instanceof Error ? error.message : 'Failed to login with GitHub'
                        });
                    }
                    break;

                case 'renewSubscription':
                    try {
                        await this._optimaProvider.renewSubscription();
                    } catch (error) {
                        webviewView.webview.postMessage({
                            error: error instanceof Error ? error.message : 'Failed to open subscription page'
                        });
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <title>Account Management</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${this._getWebviewUri(webview, 'webview-ui/dist/account.js')}"></script>
            </body>
            </html>`;
    }

    private _getWebviewUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
        return webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...pathSegments));
    }

    public getHtmlContent(): string {
        const nonce = getNonce();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._view?.webview.cspSource} 'unsafe-inline'; img-src ${this._view?.webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <title>Account Management</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${this._getWebviewUri(this._view?.webview, 'webview-ui/dist/account.js')}"></script>
            </body>
            </html>`;
    }
} 