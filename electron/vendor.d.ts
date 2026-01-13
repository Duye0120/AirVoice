declare module 'koffi' {
  export function load(path: string): any;
  export function struct(name: string, def: Record<string, string | any>): any;
  export function array(type: string, size: number): any;
  export function sizeof(type: any): number;
  export default { load, struct, array, sizeof };
}

declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
  }
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
}
