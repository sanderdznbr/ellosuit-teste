/**
 * PastelAgent v3 — porte fiel da colecao "Todos os Agentes IA"
 * (`TheodoWalls-Colecao-Agentes-IA/agentes/*`).
 *
 * Dois paths SVG persistentes: olhos -> aneis -> check / X -> olhos.
 * Sem dependencias, sem fontes remotas, sem chamadas de rede.
 *
 * Todas as nove variantes pastel do pacote compartilham esta mesma animacao e
 * mudam apenas dois grupos de valores, ambos recebidos por parametro:
 *
 * - `palette`: gradiente do corpo, sombra, cor dos olhos e cores de resultado.
 * - `shape`: o SVG do corpo (circulo, quadrado, poligonos), o deslocamento do
 *   rosto, o oval da sombra e o pivo da rotacao.
 *
 * Nada de logica foi duplicada por variante: a animacao e uma so.
 */

export type AgentState =
  | 'idle'
  | 'morph-in'
  | 'loading'
  | 'morph-success'
  | 'morph-failure'
  | 'success'
  | 'failure'
  | 'morph-out';

export type AgentOutcome = 'success' | 'failure';

/** Cor em RGB, componentes de 0 a 255. */
export type AgentRgb = [number, number, number];

export interface AgentPalette {
  /** Quatro paradas do gradiente do corpo, da mais clara a mais escura. */
  body: [string, string, string, string];
  /** Cor da sombra projetada. */
  shadow: string;
  /** Cor dos olhos e dos aneis no estado normal. */
  ink: AgentRgb;
  /** Cor do check de sucesso. Padrao: verde da familia pastel. */
  success?: AgentRgb;
  /** Cor do X de falha. Padrao: coral da familia pastel. */
  failure?: AgentRgb;
}

/**
 * Geometria do corpo. Cada variante do pacote troca somente estes valores,
 * o que mantem uma unica animacao para todos os agentes.
 */
export interface AgentShape {
  /**
   * SVG do corpo, inserido dentro de `<g class="pa-body">`. Escreva `__ID__`
   * onde o original usava o uid, para montar `url(#__ID__-body)` e
   * `url(#__ID__-sheen)`.
   */
  surface: string;
  /** Deslocamento vertical do grupo do rosto. Ausente = sem deslocamento. */
  faceOffsetY?: number;
  /** Pivo da respiracao/inclinacao do corpo. Padrao: [120, 111]. */
  pivot?: [number, number];
  /** Oval da sombra projetada. Padrao: cy 196, rx 43, ry 8.5. */
  shadow?: { cy?: number; rx?: number; ry?: number };
  /** rx da sombra no repouso, antes da respiracao. Padrao: 41. */
  shadowRx?: number;
  /** Prefixo do aria-label, ex: "Agente azul pastel". */
  aria: string;
}

export interface AgentOptions {
  manual?: boolean;
  respectReducedMotion?: boolean;
  /** Tempo de exibicao de um resultado, em ms. Padrao: 1600. */
  resultDuration?: number;
  seed?: number;
  palette: AgentPalette;
  shape: AgentShape;
}

export interface AgentResultOptions {
  hold?: number;
  autoReset?: boolean;
  message?: string;
}

export interface AgentRunOptions {
  hold?: number;
  autoReset?: boolean;
  successMessage?: string;
  failureMessage?: string;
}

interface Stroke {
  points: number[];
  width: number;
  color: number[];
}

interface PendingResult {
  type: AgentOutcome | 'idle';
  hold: number;
  autoReset: boolean;
  message: string;
}

const N = 24;
/** Verde e coral da familia pastel azul, usados quando a paleta nao os define. */
const GREEN: AgentRgb = [51, 120, 110];
const CORAL: AgentRgb = [174, 85, 102];

/** Valores de `shape` para as variantes de circulo (o caso mais antigo). */
const SHAPE_DEFAULTS = { pivot: [120, 111] as [number, number], shadowRx: 41 };

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * t * (10 + t * (-15 + 6 * t));
};
const round = (n: number) => Number(n.toFixed(4));

const LABELS: Record<AgentState, string> = {
  idle: 'Dispon\u00edvel',
  'morph-in': 'Preparando',
  loading: 'Carregando...',
  'morph-success': 'Concluindo',
  'morph-failure': 'Falha detectada',
  success: 'Conclu\u00eddo',
  failure: 'N\u00e3o foi poss\u00edvel concluir',
  'morph-out': 'Voltando ao olhar',
};

/** Instancias montadas por elemento, no lugar de poluir o no do DOM. */
const mounted = new WeakMap<HTMLElement, PastelAgent>();
let count = 0;

function duration(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite, non-negative number.`);
  }
  return value;
}

function blend(a: Stroke, b: Stroke, t: number): Stroke {
  return {
    points: a.points.map((p, i) => mix(p, b.points[i], t)),
    width: mix(a.width, b.width, t),
    color: a.color.map((c, i) => mix(c, b.color[i], t)),
  };
}

function line(x0: number, y0: number, x1: number, y1: number, width: number, color: AgentRgb): Stroke {
  const points = [x0, y0];
  for (let i = 0; i < N; i++) {
    for (let k = 1; k <= 3; k++) {
      const t = (i + k / 3) / N;
      points.push(mix(x0, x1, t), mix(y0, y1, t));
    }
  }
  return { points, width, color };
}

function pathData(p: number[]): string {
  let d = `M ${round(p[0])} ${round(p[1])}`;
  for (let i = 2; i < p.length; i += 6) {
    d += ` C ${round(p[i])} ${round(p[i + 1])} ${round(p[i + 2])} ${round(p[i + 3])} ${round(p[i + 4])} ${round(p[i + 5])}`;
  }
  return d;
}

export class PastelAgent {
  readonly root: HTMLElement;
  readonly palette: AgentPalette;
  readonly shape: AgentShape;
  state: AgentState;
  clock = 0;

  private options: Required<Omit<AgentOptions, 'palette' | 'shape'>>;
  private uid: string;
  private phaseStart = 0;
  private _seed: number;
  private _raf = 0;
  private _previous: number | null = null;
  private _paused = false;
  private _destroyed = false;
  private _hidden: boolean;
  private _generation = 0;
  private _pending: PendingResult | null = null;
  private _result: PendingResult | null = null;
  private _spin = 0;
  private _velocity = 0;
  private _blinkStart = -10000;
  private _nextBlink = 680;
  private _gazeStart = -10000;
  private _nextGaze = 1800;
  private _gazeX = 0;
  private _gazeY = 0;
  private _entryBlink = 1;
  private _entryGaze: [number, number] = [0, 0];
  private _visual: Stroke[] = [];
  private _source: Stroke[] = [];
  private _fromRing = false;
  private _resultSpin = 0;
  private _resultVelocity = 0;
  private _query: MediaQueryList;
  private _onVisibility: () => void;
  private _onMotion: () => void;

  private svg!: SVGSVGElement;
  private floatGroup!: SVGGElement;
  private bodyGroup!: SVGGElement;
  private shadow!: SVGElement;
  private eyes: SVGPathElement[] = [];

  reduced: boolean;

  constructor(element: HTMLElement | string, options: AgentOptions) {
    const root = typeof element === 'string' ? document.querySelector(element) : element;
    if (!(root instanceof HTMLElement)) throw new TypeError('An existing HTML element is required.');
    if (mounted.has(root)) throw new Error('This element already has a PastelAgent.');

    this.options = Object.assign(
      { manual: false, respectReducedMotion: true, resultDuration: 1600, seed: 9241 },
      options,
    );
    duration(this.options.resultDuration, 'resultDuration');
    this.palette = options.palette;
    this.shape = options.shape;

    this.root = root;
    this.uid = `pastel-actions-${++count}`;
    this.state = 'idle';
    this._seed = this.options.seed >>> 0;
    this._hidden = document.hidden;
    this._query = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.options.respectReducedMotion && this._query.matches;

    this._mount();

    this._onVisibility = () => {
      this._hidden = document.hidden;
      if (this._hidden) this._stopFrame();
      else this._requestFrame();
    };
    this._onMotion = () => {
      this.reduced = this.options.respectReducedMotion && this._query.matches;
      this._render();
    };

    mounted.set(root, this);
    this._query.addEventListener('change', this._onMotion);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._render();
    this._emit();
    this._requestFrame();
  }

  private _mount() {
    const id = this.uid;
    const [c0, c1, c2, c3] = this.palette.body;
    const shadow = {
      cy: this.shape.shadow?.cy ?? 196,
      rx: this.shape.shadow?.rx ?? 43,
      ry: this.shape.shadow?.ry ?? 8.5,
    };
    const face = this.shape.faceOffsetY
      ? ` transform="translate(0 ${this.shape.faceOffsetY})"`
      : '';
    this.root.classList.add('pastel-agent');
    this.root.innerHTML = `
      <svg viewBox="0 0 240 240" role="img" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="${id}-body" cx="29%" cy="20%" r="85%">
            <stop offset="0" stop-color="${c0}"/><stop offset=".35" stop-color="${c1}"/>
            <stop offset=".72" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
          </radialGradient>
          <radialGradient id="${id}-sheen" cx="33%" cy="21%" r="69%">
            <stop offset="0" stop-color="#fff" stop-opacity=".29"/>
            <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="${id}-shadow">
            <stop offset="0" stop-color="${this.palette.shadow}" stop-opacity=".18"/>
            <stop offset=".56" stop-color="${this.palette.shadow}" stop-opacity=".065"/>
            <stop offset="1" stop-color="${this.palette.shadow}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse class="pa-shadow" cx="120" cy="${shadow.cy}" rx="${shadow.rx}" ry="${shadow.ry}" fill="url(#${id}-shadow)"/>
        <g class="pa-float"><g class="pa-body">
          ${this.shape.surface.trim().replace(/__ID__/g, id)}
          <g class="pa-face"${face}><path class="pa-eye" data-eye="left"/><path class="pa-eye" data-eye="right"/></g>
        </g></g>
      </svg>`;
    this.svg = this.root.querySelector('svg') as SVGSVGElement;
    this.floatGroup = this.root.querySelector('.pa-float') as SVGGElement;
    this.bodyGroup = this.root.querySelector('.pa-body') as SVGGElement;
    this.shadow = this.root.querySelector('.pa-shadow') as SVGElement;
    this.eyes = Array.from(this.root.querySelectorAll('.pa-eye')) as SVGPathElement[];
  }

  private _random() {
    this._seed = (1664525 * this._seed + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }
  get busy() {
    return this.state !== 'idle';
  }
  get processing() {
    return this.state === 'morph-in' || this.state === 'loading';
  }
  get paused() {
    return this._paused;
  }
  get label() {
    return (this.state === 'success' || this.state === 'failure') && this._result?.message
      ? this._result.message
      : LABELS[this.state];
  }

  private _emit() {
    this.root.dataset.state = this.state;
    this.svg.setAttribute('aria-label', `${this.shape.aria}: ${this.label}`);
    this.root.setAttribute('aria-busy', String(this.processing));
    this.root.dispatchEvent(
      new CustomEvent('agentstatechange', {
        detail: {
          state: this.state,
          label: this.label,
          busy: this.busy,
          processing: this.processing,
          outcome: this._result?.type || null,
        },
      }),
    );
  }

  private _setState(next: AgentState) {
    this.state = next;
    this.phaseStart = this.clock;
    this._emit();
  }

  private _requestFrame() {
    if (this.options.manual || this._destroyed || this._paused || this._hidden || this._raf) return;
    this._previous = null;
    const tick = (now: number) => {
      this._raf = 0;
      if (this._destroyed || this._paused || this._hidden) return;
      const dt = this._previous === null ? 0 : Math.min(64, now - this._previous);
      this._previous = now;
      this._step(dt);
      if (!this._destroyed && !this._paused && !this._hidden) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  private _stopFrame() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._previous = null;
  }

  private _step(dt: number) {
    this.clock += dt;
    const age = this.clock - this.phaseStart;
    if (this.state === 'morph-in' && age >= (this.reduced ? 0 : 1050)) {
      this._spin = 0;
      this._velocity = 0;
      this._setState('loading');
    } else if (this.state === 'loading') {
      this._velocity = this.reduced ? 0 : 4.6 * smooth(age / 300);
      this._spin += (dt / 1000) * this._velocity;
      if (this._pending && age >= 180) {
        const pending = this._pending;
        this._pending = null;
        // Usa o caminho atual exato, nunca um icone defasado ou aproximado.
        this._render();
        if (pending.type === 'idle') this._beginReturn();
        else this._beginResult(pending);
      }
    } else if (
      (this.state === 'morph-success' || this.state === 'morph-failure') &&
      age >= (this.reduced ? 0 : 1120)
    ) {
      const completed = this._result;
      if (completed) {
        this._setState(completed.type);
        this.root.dispatchEvent(
          new CustomEvent('agentcomplete', {
            detail: { outcome: completed.type, message: completed.message || LABELS[completed.type] },
          }),
        );
      }
    } else if (
      (this.state === 'success' || this.state === 'failure') &&
      this._result?.autoReset &&
      age >= this._result.hold
    ) {
      this._render();
      this._beginReturn();
    } else if (this.state === 'morph-out' && age >= (this.reduced ? 0 : 820)) {
      this._result = null;
      this._spin = 0;
      this._blinkStart = -10000;
      this._gazeStart = -10000;
      this._nextBlink = this.clock + 280;
      this._nextGaze = this.clock + 1600;
      this._setState('idle');
    }
    if (this.state === 'idle' && !this.reduced) {
      if (this.clock >= this._nextBlink) {
        this._blinkStart = this.clock;
        this._nextBlink = this.clock + 2500 + this._random() * 1700;
      }
      if (this.clock >= this._nextGaze) {
        this._gazeStart = this.clock;
        this._gazeX = this._random() < 0.5 ? -3.6 : 3.6;
        this._gazeY = this._random() * 1.7 - 0.85;
        this._nextGaze = this.clock + 4300 + this._random() * 1800;
      }
    }
    this._render();
  }

  private _blink() {
    if (this.state !== 'idle' || this.reduced) return 1;
    const t = this.clock - this._blinkStart;
    if (t < 0 || t > 230) return 1;
    if (t < 85) return mix(1, 0.045, smooth(t / 85));
    if (t < 135) return 0.045;
    return mix(0.045, 1, smooth((t - 135) / 95));
  }

  private _gaze(): [number, number] {
    if (this.state !== 'idle' || this.reduced) return [0, 0];
    const t = this.clock - this._gazeStart;
    const w = smooth(t / 440) * (1 - smooth((t - 1360) / 650));
    return [this._gazeX * w, this._gazeY * w];
  }

  /** Os mesmos 24 segmentos cubicos da animacao aprovada de olho -> anel. */
  private _eye(morph: number, dir: number, angle = 0, blink = 1, gaze: number[] = [0, 0]): Stroke {
    const alpha = 2.7 * morph;
    const amount = smooth(morph);
    const length = mix(18, 2 * 2.7 * 10.7, amount);
    const open = mix(blink, 1, amount);
    const coords: number[] = [];
    if (alpha < 0.00001) {
      const half = length / 2;
      coords.push(0, -half);
      for (let i = 0; i < N; i++)
        for (let k = 1; k <= 3; k++) coords.push(0, -half + (length * (i + k / 3)) / N);
    } else {
      const radius = length / (2 * alpha);
      const offset = 1 - amount;
      const step = (2 * alpha) / N;
      const k = (4 / 3) * Math.tan(step / 4);
      const at = (a: number): [number, number] => [
        dir * radius * (Math.cos(a) - offset),
        radius * Math.sin(a),
      ];
      let a = -alpha;
      coords.push(...at(a));
      for (let i = 0; i < N; i++) {
        const b = a + step;
        const s = at(a);
        const e = at(b);
        coords.push(
          s[0] - dir * radius * Math.sin(a) * k,
          s[1] + radius * Math.cos(a) * k,
          e[0] + dir * radius * Math.sin(b) * k,
          e[1] - radius * Math.cos(b) * k,
          e[0],
          e[1],
        );
        a = b;
      }
    }
    const cx = 120 + dir * mix(16.4, 21.7, amount) + gaze[0];
    const cy = mix(113, 112, amount) + gaze[1];
    const rot = dir * angle;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i];
      const y = coords[i + 1] * open;
      coords[i] = cx + x * c - y * s;
      coords[i + 1] = cy + x * s + y * c;
    }
    return { points: coords, width: mix(7.4, 3.15, amount), color: this.palette.ink };
  }

  private _neutral() {
    return [-1, 1].map((dir) => this._eye(0, dir));
  }

  private _symbol(type: AgentOutcome): Stroke[] {
    // Cada olho vira um traco. Nenhum check ou X adicionado por cima.
    const ok = this.palette.success ?? GREEN;
    const no = this.palette.failure ?? CORAL;
    if (type === 'success')
      return [line(100, 112, 114, 125, 5.4, ok), line(114, 125, 140, 98, 5.4, ok)];
    return [line(105, 98, 135, 128, 4.9, no), line(135, 98, 105, 128, 4.9, no)];
  }

  private _model(): Stroke[] {
    const age = this.clock - this.phaseStart;
    if (this.state === 'idle') {
      return [-1, 1].map((dir) => this._eye(0, dir, 0, this._blink(), this._gaze()));
    }
    if (this.state === 'morph-in') {
      const m = this.reduced ? [1, 1] : [smooth(age / 960), smooth((age - 65) / 985)];
      const g = this._entryGaze.map((n) => n * (1 - smooth(age / 240)));
      const b = mix(this._entryBlink, 1, smooth(age / 180));
      return [-1, 1].map((dir, i) => this._eye(m[i], dir, 0, b, g));
    }
    if (this.state === 'loading')
      return [-1, 1].map((dir) => this._eye(1, dir, this.reduced ? 0 : this._spin));
    if (this.state === 'morph-success' || this.state === 'morph-failure') {
      const type = this._result?.type === 'failure' ? 'failure' : 'success';
      const targets = this._symbol(type);
      if (this.reduced) return targets;
      let source = this._source;
      if (this._fromRing) {
        // Integra uma velocidade angular suavizada: sem reset brusco de rotacao.
        const u = clamp(age / 520);
        const integral = u - 2.5 * u ** 4 + 3 * u ** 5 - u ** 6;
        const angle = this._resultSpin + this._resultVelocity * 0.52 * integral;
        source = [-1, 1].map((dir) => this._eye(1, dir, angle));
      }
      return source.map((p, i) =>
        blend(p, targets[i], smooth((age - 220 - i * 35) / (900 - i * 35))),
      );
    }
    if (this.state === 'success' || this.state === 'failure') return this._symbol(this.state);
    const to = this._neutral();
    return this._source.map((p, i) =>
      blend(p, to[i], this.reduced ? 1 : smooth((age - i * 30) / (820 - i * 30))),
    );
  }

  private _render() {
    if (this._destroyed) return;
    const age = this.clock - this.phaseStart;
    const time = this.clock / 1000;
    const visual = this._model();
    this._visual = visual;
    visual.forEach((model, i) => {
      const eye = this.eyes[i];
      if (!eye) return;
      eye.setAttribute('d', pathData(model.points));
      eye.setAttribute('stroke-width', String(round(model.width)));
      eye.style.stroke = `rgb(${model.color.map(Math.round).join(',')})`;
    });
    let y = this.reduced ? 0 : Math.sin(time * 1.21) * 4.1;
    let scale = this.reduced ? 1 : 1 + Math.sin(time * 1.56) * 0.008;
    let tilt = 0;
    if (!this.reduced && (this.state === 'morph-success' || this.state === 'morph-failure')) {
      const pulse = Math.sin(Math.PI * clamp(age / 1120)) ** 2;
      if (this.state === 'morph-success') {
        y -= pulse * 2.0;
        scale += pulse * 0.013;
      } else {
        tilt = -pulse * 1.7;
      }
    }
    this.floatGroup.setAttribute('transform', `translate(0 ${round(y)})`);
    const [px, py] = this.shape.pivot ?? SHAPE_DEFAULTS.pivot;
    this.bodyGroup.setAttribute(
      'transform',
      `translate(${px} ${py}) rotate(${round(tilt)}) scale(${round(scale)}) translate(${-px} ${-py})`,
    );
    this.shadow.setAttribute('rx', String(round((this.shape.shadowRx ?? SHAPE_DEFAULTS.shadowRx) + y * 0.8)));
    this.shadow.setAttribute('opacity', String(round(0.86 + y * 0.025)));
  }

  private _outcome(type: AgentOutcome, options: AgentResultOptions = {}) {
    if (this._destroyed) return false;
    const hold =
      options.hold === undefined ? this.options.resultDuration : duration(options.hold, 'hold');
    const result: PendingResult = {
      type,
      hold,
      autoReset: options.autoReset !== false,
      message: options.message == null ? '' : String(options.message).slice(0, 500),
    };
    if (this._pending || !['idle', 'morph-in', 'loading'].includes(this.state)) return false;
    if (this.processing) this._pending = result;
    else {
      this._render();
      this._beginResult(result);
      this._render();
    }
    return true;
  }

  private _beginResult(result: PendingResult) {
    this._fromRing = this.state === 'loading';
    this._source = this._visual;
    this._resultSpin = this._spin;
    this._resultVelocity = this._velocity;
    this._result = result;
    this._setState(result.type === 'success' ? 'morph-success' : 'morph-failure');
  }

  private _beginReturn() {
    this._source = this._visual;
    this._pending = null;
    this._setState('morph-out');
  }

  startLoading(): boolean {
    if (this._destroyed) throw new Error('This agent has been destroyed.');
    if (this.state !== 'idle') return false;
    this._generation++;
    this._pending = null;
    this._result = null;
    this._entryBlink = this._blink();
    this._entryGaze = this._gaze();
    this._spin = 0;
    this._velocity = 0;
    this._setState('morph-in');
    this._render();
    return true;
  }

  success(options: AgentResultOptions = {}) {
    return this._outcome('success', options);
  }
  fail(options: AgentResultOptions = {}) {
    return this._outcome('failure', options);
  }
  finishLoading(outcome?: AgentOutcome, options: AgentResultOptions = {}) {
    if (outcome === 'success') return this.success(options);
    if (outcome === 'failure') return this.fail(options);
    if (outcome !== undefined) throw new TypeError('Use success, failure, or no argument.');
    if (!this.processing || this._pending) return false;
    this._pending = { type: 'idle', hold: 0, autoReset: true, message: '' };
    return true;
  }

  idle(options: { immediate?: boolean } = {}) {
    if (this._destroyed) return false;
    this._generation++; // Invalida atualizacoes visuais de tarefas assincronas antigas.
    this._pending = null;
    if (options.immediate || this.state === 'idle') {
      this._result = null;
      this._spin = 0;
      this._gazeStart = -10000;
      this._blinkStart = -10000;
      this._nextBlink = this.clock + 650;
      this._nextGaze = this.clock + 1800;
      this._setState('idle');
    } else {
      this._render();
      this._beginReturn();
    }
    this._render();
    return true;
  }

  reset() {
    return this.idle({ immediate: true });
  }

  setState(
    state: 'idle' | 'loading' | 'success' | 'failure',
    options: AgentResultOptions & { immediate?: boolean } = {},
  ) {
    if (state === 'idle') return this.idle(options);
    if (state === 'loading') return this.startLoading();
    if (state === 'success') return this.success(options);
    if (state === 'failure') return this.fail(options);
    throw new TypeError('Public states: idle, loading, success, failure.');
  }

  async run<T>(
    task: (() => T | PromiseLike<T>) | PromiseLike<T>,
    options: AgentRunOptions = {},
  ): Promise<T> {
    if (typeof task !== 'function' && (!task || typeof task.then !== 'function')) {
      throw new TypeError('run() requires a function or Promise.');
    }
    if (options.hold !== undefined) duration(options.hold, 'hold');
    if (!this.startLoading()) {
      const error = new Error('The agent is busy. Wait for idle, or call idle()/reset().');
      (error as Error & { code?: string }).code = 'AGENT_BUSY';
      throw error;
    }
    const token = this._generation;
    try {
      const value = await (typeof task === 'function' ? task() : task);
      if (!this._destroyed && token === this._generation) {
        this.success({
          hold: options.hold,
          autoReset: options.autoReset,
          message: options.successMessage,
        });
      }
      return value;
    } catch (error) {
      if (!this._destroyed && token === this._generation) {
        this.fail({
          hold: options.hold,
          autoReset: options.autoReset,
          message: options.failureMessage,
        });
      }
      throw error; // O erro original da tarefa nunca e engolido.
    }
  }

  pause() {
    if (this._destroyed) return;
    this._paused = true;
    this._stopFrame();
    this.root.dispatchEvent(new CustomEvent('agentpausechange', { detail: { paused: true } }));
  }

  resume() {
    if (this._destroyed) return;
    this._paused = false;
    this._requestFrame();
    this.root.dispatchEvent(new CustomEvent('agentpausechange', { detail: { paused: false } }));
  }

  advance(milliseconds: number) {
    if (!this.options.manual) throw new Error('advance() is for manual mode only.');
    duration(milliseconds, 'milliseconds');
    if (this._destroyed || this._paused) return;
    let left = milliseconds;
    while (left > 0) {
      const dt = Math.min(left, 1000 / 60);
      this._step(dt);
      left -= dt;
    }
    if (milliseconds === 0) this._render();
  }

  destroy() {
    if (this._destroyed) return;
    this._generation++;
    this._destroyed = true;
    this._stopFrame();
    this._query.removeEventListener('change', this._onMotion);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.root.removeAttribute('aria-busy');
    mounted.delete(this.root);
    // Deixa o ultimo quadro estatico; o elemento de montagem pertence a aplicacao.
  }
}
