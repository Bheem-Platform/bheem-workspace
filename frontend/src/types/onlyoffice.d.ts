/**
 * OnlyOffice TypeScript Declarations
 * Shared types for OnlyOffice document editors
 */

interface OnlyOfficeEditorConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions?: {
      comment?: boolean;
      download?: boolean;
      edit?: boolean;
      print?: boolean;
      review?: boolean;
    };
  };
  documentType: string;
  editorConfig: {
    callbackUrl: string;
    lang?: string;
    mode?: string;
    user?: {
      id: string;
      name: string;
    };
    customization?: {
      autosave?: boolean;
      chat?: boolean;
      comments?: boolean;
      compactHeader?: boolean;
      compactToolbar?: boolean;
      feedback?: boolean;
      forcesave?: boolean;
      help?: boolean;
      hideRightMenu?: boolean;
      logo?: {
        image?: string;
        url?: string;
      };
      toolbarNoTabs?: boolean;
      zoom?: number;
    };
  };
  height?: string;
  width?: string;
  type?: string;
  token?: string;
  events?: {
    onReady?: () => void;
    onDocumentReady?: () => void;
    onAppReady?: () => void;
    onError?: (event: any) => void;
    onDocumentStateChange?: (event: any) => void;
    onWarning?: (event: any) => void;
  };
}

interface OnlyOfficeDocEditorInstance {
  destroyEditor: () => void;
  refreshHistory: (data: any) => void;
  executeCommand: (command: string, params?: any) => void;
  serviceCommand: (command: string, params?: any) => void;
}

interface OnlyOfficeDocsAPI {
  DocEditor: new (containerId: string, config: OnlyOfficeEditorConfig) => OnlyOfficeDocEditorInstance;
}

declare global {
  interface Window {
    DocsAPI?: OnlyOfficeDocsAPI;
  }
}

export {};
