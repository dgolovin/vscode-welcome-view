/**
 * Copyright 2019 Red Hat, Inc. and others.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as ejs from 'ejs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs-extra';


export class WelcomeWebview {

  public static currentPanel: WelcomeWebview;

  private readonly DEFAULT_RESOURCE_FOLDER: string = 'assets';
  private _assetsPath: string;
  private _extensionPath: string;
  private _extensionID: string;
  private _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _showWelcomeConfigScope: string;
  private _showWelcomeConfigName: string;

  public static createOrShow(extensionId: string, extensionPath: string, assetsPath: string, showWelcomeConfigName: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (WelcomeWebview.currentPanel) {
      WelcomeWebview.currentPanel._panel.reveal(column);
      return;
    }

    WelcomeWebview.currentPanel = new WelcomeWebview(extensionId, extensionPath, assetsPath, showWelcomeConfigName);
  }

  private constructor(extensionID: string, extensionPath: string, assetsPath: string, showWelcomeConfigName: string) {
    this._extensionPath = extensionPath;
    this._extensionID = extensionID;
    this._assetsPath = assetsPath;
    this._showWelcomeConfigScope = showWelcomeConfigName.substr(0, showWelcomeConfigName.indexOf('.')); 
    this._showWelcomeConfigName = showWelcomeConfigName.substr(showWelcomeConfigName.indexOf('.')+1);
    this._panel = this.createPanel();
    this.setPanelHtml();
    this.setCheckboxListener();
    this.setConfigListener();
  }

  private createPanel(): vscode.WebviewPanel {
    const extDisplayName = vscode.extensions.getExtension(this._extensionID).packageJSON.displayName;
    const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
      'welcome', // Identifies the type of the webview. Used internally
      `${extDisplayName} for ${vscode.env.appName}`, // Title of the panel displayed to the user
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, // Editor column to show the new webview panel in.
      {
        enableCommandUris: true,
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._extensionPath, this._assetsPath)),
          vscode.Uri.file(path.join(__dirname, '..', this.DEFAULT_RESOURCE_FOLDER))]
      }
    );
    panel.iconPath = {
      light: vscode.Uri.file(path.join(this._extensionPath, this._assetsPath, 'icons', 'extension_icon_1color_32px_default.png')),
      dark: vscode.Uri.file(path.join(this._extensionPath, this._assetsPath, 'icons', 'extension_icon_1color_32px_reverse.png'))
    };
    panel.onDidDispose(() => this.dispose(), null, this._disposables);
    return panel;
  }

  private async setPanelHtml(): Promise<void> {
    this._panel.webview.html = await this.getWebviewContent();
  }

  private async getWebviewContent(): Promise<string> {

    const htmlTemplatePath: string = this.getHtmlTemplateUri().fsPath;
    const extensionStatus: string = vscode.extensions.getExtension(this._extensionID).packageJSON.preview ? 'Preview' : '';

    const data = {
      appName: vscode.env.appName,
      checkboxValue: vscode.workspace.getConfiguration(this._showWelcomeConfigScope).get(this._showWelcomeConfigName),
      cssUri: this.getCssUri(),
      cspSource: this._panel.webview.cspSource,
      jsUri: this.getJsUri(),
      status: extensionStatus,
    };

    return await new Promise((resolve: any, reject: any): any => {
      ejs.renderFile(htmlTemplatePath, data, { async: true }, (error: any, data: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  private getCssUri(): vscode.Uri {
    const extensionStylesPath = path.join(this._extensionPath, this._assetsPath, 'styles', 'welcome.css');
    const packageStylesPath = path.resolve(__dirname, '..', this.DEFAULT_RESOURCE_FOLDER, 'styles', 'welcome.css');
    const css: vscode.Uri = vscode.Uri.file(fs.existsSync(extensionStylesPath)? extensionStylesPath: packageStylesPath);
    return this._panel.webview.asWebviewUri(css);
  }

  private getJsUri(): vscode.Uri {
    const css: vscode.Uri = vscode.Uri.file(
      path.resolve(__dirname, '..', this.DEFAULT_RESOURCE_FOLDER, 'scripts', 'welcome.js')
    );

    return this._panel.webview.asWebviewUri(css);
  }

  private getHtmlTemplateUri(): vscode.Uri {
    return vscode.Uri.file(
      path.join(this._extensionPath, this._assetsPath, 'templates', 'welcome.ejs')
    );
  }

  private setCheckboxListener() {
    this._panel.webview.onDidReceiveMessage(
      message => {
        if (message.command === 'checkbox-changed') {
          const checkboxValue: boolean = message.newValue;
          vscode.workspace.getConfiguration(this._showWelcomeConfigScope).update(this._showWelcomeConfigName, checkboxValue);
        }
      },
      undefined,
      this._disposables
    );
  }

  private setConfigListener() {
    vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (event.affectsConfiguration(this._showWelcomeConfigScope) && WelcomeWebview.currentPanel) {
        this.setPanelHtml();
      }
    },
      undefined,
      this._disposables);
  }

  private dispose() {
    WelcomeWebview.currentPanel = undefined;
    while (this._disposables.length) {
      const x: vscode.Disposable = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
