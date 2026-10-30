function download(filename: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

/** Browser equivalent of "save as file": a normal download. */
export async function saveTextFile(filename: string, text: string): Promise<string> {
  return download(filename, new Blob([text], { type: 'application/json' }));
}

export async function saveBinaryFile(filename: string, bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return download(filename, new Blob([buffer], { type: 'application/zip' }));
}

function pickFile(accept: string, read: (file: globalThis.File) => Promise<unknown>): Promise<unknown> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void read(file).then(resolve);
    };

    input.click();
  });
}

export async function pickTextFile(): Promise<string | null> {
  return (await pickFile('application/json,.json', (file) => file.text())) as string | null;
}

export async function pickBinaryFile(): Promise<Uint8Array | null> {
  return (await pickFile('application/zip,.zip', async (file) => new Uint8Array(await file.arrayBuffer()))) as
    | Uint8Array
    | null;
}

export function reloadApp(): void {
  window.location.reload();
}
