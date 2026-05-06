import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  sessionId: string;
  fontSize?: number;
  onReady?: () => void;
}

export function Terminal({ sessionId, fontSize = 14, onReady }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const doFit = useCallback(() => {
    if (fitRef.current && termRef.current) {
      try {
        fitRef.current.fit();
        const { cols, rows } = termRef.current;
        window.api.resizeTerminal(sessionId, cols, rows);
      } catch {}
    }
  }, [sessionId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 10000,
      allowTransparency: true,
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        foreground: '#d4d4d8',
        cursor: '#a1a1aa',
        selectionBackground: 'rgba(110, 142, 247, 0.2)',
        selectionForeground: '#ffffff',
        black: '#18181b',
        red: '#ef6b73',
        green: '#5ccb8f',
        yellow: '#e8c47c',
        blue: '#6e8ef7',
        magenta: '#b392f0',
        cyan: '#70c0e8',
        white: '#d4d4d8',
        brightBlack: '#52525b',
        brightRed: '#ef6b73',
        brightGreen: '#5ccb8f',
        brightYellow: '#e8c47c',
        brightBlue: '#6e8ef7',
        brightMagenta: '#b392f0',
        brightCyan: '#70c0e8',
        brightWhite: '#fafafa',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Initial fit
    setTimeout(() => {
      doFit();
      onReady?.();
    }, 50);

    // Listen for session output
    const unsubOutput = window.api.onSessionOutput(sessionId, (data) => {
      term.write(data);
    });

    // Listen for session exit
    const unsubExit = window.api.onSessionExit(sessionId, () => {
      term.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n');
    });

    // Forward terminal input to PTY
    const inputDisposable = term.onData((data) => {
      window.api.sendInput(sessionId, data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => doFit());
    resizeObserver.observe(containerRef.current);

    cleanupRef.current = () => {
      unsubOutput();
      unsubExit();
      inputDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [sessionId, fontSize, doFit, onReady]);

  // Restore buffer on mount
  useEffect(() => {
    const loadBuffer = async () => {
      const buffer = await window.api.loadBuffer(sessionId);
      if (buffer && termRef.current) {
        termRef.current.write(buffer);
      }
    };
    loadBuffer();
  }, [sessionId]);

  // Refit on window resize
  useEffect(() => {
    const handleResize = () => doFit();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [doFit]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: '4px' }}
    />
  );
}
