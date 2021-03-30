const vscode = acquireVsCodeApi();

document.addEventListener("DOMContentLoaded", function(event) {

  const checkbox = document.getElementById('showWhenUsingExtension');

  checkbox.addEventListener('click', () => {
    vscode.postMessage({
      command: 'checkbox-changed',
      newValue: checkbox.checked
    })
  });
});