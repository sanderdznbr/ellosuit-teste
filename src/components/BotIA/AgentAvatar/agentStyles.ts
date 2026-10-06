import type { AgentPalette, AgentShape } from './pastelAgentCore';

export interface AgentStyle {
  /** Valor persistido em `ai_agents.settings.agentStyle`. */
  id: string;
  name: string;
  /** Frase curta mostrada abaixo do nome no selecionador. */
  description: string;
  palette: AgentPalette;
  shape: AgentShape;
}

/**
 * Catalogo de estilos do avatar do agente.
 *
 * ARQUIVO GERADO por `.freebuff/gen-agent-styles.mjs` a partir dos `agent.js`
 * originais da colecao "Todos os Agentes IA". Nao edite a mao: ajuste o gerador
 * e rode `node .freebuff/gen-agent-styles.mjs`.
 *
 * As nove variantes compartilham a mesma animacao e mudam apenas paleta e
 * geometria. Para adicionar um estilo, acrescente uma linha em ROWS no gerador:
 * o selecionador da etapa "Perfil" e a lista de agentes passam a oferece-lo
 * automaticamente, e `ai_agents.settings.agentStyle` guarda o id escolhido.
 */
export const AGENT_STYLES: AgentStyle[] = [
  {
    id: 'azul-pastel',
    name: 'Azul Pastel',
    description: 'Calmo e confiável',
    palette: {
      body: ['#e0efff', '#c9e3ff', '#b3d5f7', '#99bfe8'],
      shadow: '#7999bc',
      ink: [41, 67, 95],
      success: [51, 120, 110],
      failure: [174, 85, 102],
    },
    shape: {
      aria: 'Agente azul pastel',
      pivot: [120, 111],
      shadow: { cy: 196, rx: 43, ry: 8.5 },
      shadowRx: 41,
      surface: `<circle cx="120" cy="111" r="64" fill="url(#__ID__-body)"/><circle cx="120" cy="111" r="63.5" fill="url(#__ID__-sheen)" stroke="#fff" stroke-opacity=".17"/>`,
    },
  },
  {
    id: 'verde-pastel',
    name: 'Verde Pastel',
    description: 'Próximo e acolhedor',
    palette: {
      body: ['#dff4e7', '#c9e8d5', '#b3ddc3', '#95c6ae'],
      shadow: '#799f8b',
      ink: [46, 75, 64],
      success: [52, 122, 97],
      failure: [174, 85, 102],
    },
    shape: {
      aria: 'Agente verde pastel',
      pivot: [120, 111],
      shadow: { cy: 196, rx: 43, ry: 8.5 },
      shadowRx: 41,
      surface: `<circle cx="120" cy="111" r="64" fill="url(#__ID__-body)"/><circle cx="120" cy="111" r="63.5" fill="url(#__ID__-sheen)" stroke="#fff" stroke-opacity=".17"/>`,
    },
  },
  {
    id: 'verde-quadrado',
    name: 'Verde Quadrado',
    description: 'Sólido e direto',
    palette: {
      body: ['#dff4e7', '#c9e8d5', '#b3ddc3', '#95c6ae'],
      shadow: '#799f8b',
      ink: [46, 75, 64],
      success: [52, 122, 97],
      failure: [174, 85, 102],
    },
    shape: {
      aria: 'Agente quadrado verde pastel',
      pivot: [120, 111],
      shadow: { cy: 196, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<rect class="pa-surface" x="56" y="47" width="128" height="128" rx="20" fill="url(#__ID__-body)"/><rect class="pa-sheen" x="56.5" y="47.5" width="127" height="127" rx="19.5" fill="url(#__ID__-sheen)" stroke="#fff" stroke-opacity=".17"/>`,
    },
  },
  {
    id: 'laranja-triangulo',
    name: 'Laranja Triângulo',
    description: 'Energético e atento',
    palette: {
      body: ['#fff0dd', '#fad8b4', '#f3c18f', '#e5a878'],
      shadow: '#b18b6b',
      ink: [101, 73, 52],
      success: [52, 122, 97],
      failure: [180, 78, 96],
    },
    shape: {
      aria: 'Agente triangular laranja pastel',
      faceOffsetY: 9,
      pivot: [120, 120],
      shadow: { cy: 196, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<path class="pa-surface" d="M 111.1753 45.6884 Q 120.0000 30.0000 128.8247 45.6884 L 192.1753 158.3116 Q 201.0000 174.0000 183.0000 174.0000 L 57.0000 174.0000 Q 39.0000 174.0000 47.8247 158.3116 Z" fill="url(#__ID__-body)"/><path class="pa-sheen" d="M 111.1753 45.6884 Q 120.0000 30.0000 128.8247 45.6884 L 192.1753 158.3116 Q 201.0000 174.0000 183.0000 174.0000 L 57.0000 174.0000 Q 39.0000 174.0000 47.8247 158.3116 Z" fill="url(#__ID__-sheen)" stroke="#fff" stroke-width=".65" stroke-opacity=".20"/>`,
    },
  },
  {
    id: 'lilas-losango',
    name: 'Lilás Losango',
    description: 'Criativo e gentil',
    palette: {
      body: ['#f3ebff', '#e2d1f5', '#cbb5e8', '#b9a0d9'],
      shadow: '#8c78a5',
      ink: [85, 67, 104],
      success: [52, 122, 97],
      failure: [180, 78, 96],
    },
    shape: {
      aria: 'Agente losango lilás pastel',
      faceOffsetY: -2,
      pivot: [120, 110],
      shadow: { cy: 213, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<path class="pa-surface" d="M 111.85 34.00 Q 120.00 25.00 128.15 34.00 L 188.85 101.00 Q 197.00 110.00 188.85 119.00 L 128.15 186.00 Q 120.00 195.00 111.85 186.00 L 51.15 119.00 Q 43.00 110.00 51.15 101.00 Z" fill="url(#__ID__-body)"/><path class="pa-sheen" d="M 111.85 34.00 Q 120.00 25.00 128.15 34.00 L 188.85 101.00 Q 197.00 110.00 188.85 119.00 L 128.15 186.00 Q 120.00 195.00 111.85 186.00 L 51.15 119.00 Q 43.00 110.00 51.15 101.00 Z" fill="url(#__ID__-sheen)" stroke="#fff" stroke-width=".65" stroke-opacity=".20"/>`,
    },
  },
  {
    id: 'amarelo-hexagono',
    name: 'Amarelo Hexágono',
    description: 'Otimista e organizado',
    palette: {
      body: ['#fff8dc', '#f8e8ae', '#efd48c', '#e4c275'],
      shadow: '#a28b52',
      ink: [103, 82, 44],
      success: [52, 122, 97],
      failure: [180, 78, 96],
    },
    shape: {
      aria: 'Agente hexágono amarelo-manteiga pastel',
      faceOffsetY: -2,
      pivot: [120, 110],
      shadow: { cy: 213, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<path class="pa-surface" d="M 195.000 101.340 Q 200.000 110.000 195.000 118.660 L 165.000 170.622 Q 160.000 179.282 150.000 179.282 L 90.000 179.282 Q 80.000 179.282 75.000 170.622 L 45.000 118.660 Q 40.000 110.000 45.000 101.340 L 75.000 49.378 Q 80.000 40.718 90.000 40.718 L 150.000 40.718 Q 160.000 40.718 165.000 49.378 Z" fill="url(#__ID__-body)"/><path class="pa-sheen" d="M 195.000 101.340 Q 200.000 110.000 195.000 118.660 L 165.000 170.622 Q 160.000 179.282 150.000 179.282 L 90.000 179.282 Q 80.000 179.282 75.000 170.622 L 45.000 118.660 Q 40.000 110.000 45.000 101.340 L 75.000 49.378 Q 80.000 40.718 90.000 40.718 L 150.000 40.718 Q 160.000 40.718 165.000 49.378 Z" fill="url(#__ID__-sheen)" stroke="#fff" stroke-width=".65" stroke-opacity=".20"/>`,
    },
  },
  {
    id: 'rosa-pentagono',
    name: 'Rosa Pentágono',
    description: 'Cordial e sociável',
    palette: {
      body: ['#fff0f5', '#f9d5e4', '#efb6cf', '#e6a3c1'],
      shadow: '#b07693',
      ink: [98, 59, 83],
      success: [52, 122, 97],
      failure: [180, 78, 96],
    },
    shape: {
      aria: 'Agente pentágono rosa pastel',
      faceOffsetY: -2,
      pivot: [120, 110],
      shadow: { cy: 213, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<path class="pa-surface" d="M 111.101 32.466 Q 120.000 26.000 128.899 32.466 L 190.990 77.577 Q 199.889 84.043 196.490 94.504 L 172.773 167.496 Q 169.374 177.957 158.374 177.957 L 81.626 177.957 Q 70.626 177.957 67.227 167.496 L 43.510 94.504 Q 40.111 84.043 49.010 77.577 Z" fill="url(#__ID__-body)"/><path class="pa-sheen" d="M 111.101 32.466 Q 120.000 26.000 128.899 32.466 L 190.990 77.577 Q 199.889 84.043 196.490 94.504 L 172.773 167.496 Q 169.374 177.957 158.374 177.957 L 81.626 177.957 Q 70.626 177.957 67.227 167.496 L 43.510 94.504 Q 40.111 84.043 49.010 77.577 Z" fill="url(#__ID__-sheen)" stroke="#fff" stroke-width=".65" stroke-opacity=".20"/>`,
    },
  },
  {
    id: 'turquesa-trapezio',
    name: 'Turquesa Trapézio',
    description: 'Claro e confiável',
    palette: {
      body: ['#edfcfa', '#c8efeb', '#a0ddd7', '#82cac6'],
      shadow: '#5eaaa6',
      ink: [39, 88, 92],
      success: [52, 122, 97],
      failure: [180, 78, 96],
    },
    shape: {
      aria: 'Agente trapézio turquesa pastel',
      faceOffsetY: 4,
      pivot: [120, 110],
      shadow: { cy: 213, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<path class="pa-surface" d="M 72.013 56.420 Q 76.000 43.000 90.000 43.000 L 150.000 43.000 Q 164.000 43.000 167.987 56.420 L 201.013 167.580 Q 205.000 181.000 191.000 181.000 L 49.000 181.000 Q 35.000 181.000 38.987 167.580 Z" fill="url(#__ID__-body)"/><path class="pa-sheen" d="M 72.013 56.420 Q 76.000 43.000 90.000 43.000 L 150.000 43.000 Q 164.000 43.000 167.987 56.420 L 201.013 167.580 Q 205.000 181.000 191.000 181.000 L 49.000 181.000 Q 35.000 181.000 38.987 167.580 Z" fill="url(#__ID__-sheen)" stroke="#fff" stroke-width=".65" stroke-opacity=".20"/>`,
    },
  },
  {
    id: 'perola-estrela',
    name: 'Pérola Estrela',
    description: 'Neutro e premium',
    palette: {
      body: ['#fbfbfc', '#e9e9ed', '#d3d4dc', '#babdc8'],
      shadow: '#969ba9',
      ink: [69, 71, 84],
      success: [52, 122, 97],
      failure: [180, 78, 96],
    },
    shape: {
      aria: 'Agente estrela cinza-pérola',
      faceOffsetY: -1,
      pivot: [120, 110],
      shadow: { cy: 213, rx: 49, ry: 8.5 },
      shadowRx: 47,
      surface: `<path class="pa-surface" d="M 112.623 28.898 Q 120.000 17.000 127.377 28.898 L 146.704 60.069 Q 151.447 67.718 160.187 69.864 L 195.803 78.613 Q 209.399 81.952 200.363 92.646 L 176.691 120.658 Q 170.882 127.532 171.541 136.508 L 174.227 173.085 Q 175.252 187.048 162.290 181.758 L 128.333 167.901 Q 120.000 164.500 111.667 167.901 L 77.710 181.758 Q 64.748 187.048 65.773 173.085 L 68.459 136.508 Q 69.118 127.532 63.309 120.658 L 39.637 92.646 Q 30.601 81.952 44.197 78.613 L 79.813 69.864 Q 88.553 67.718 93.296 60.069 Z" fill="url(#__ID__-body)"/><path class="pa-sheen" d="M 112.623 28.898 Q 120.000 17.000 127.377 28.898 L 146.704 60.069 Q 151.447 67.718 160.187 69.864 L 195.803 78.613 Q 209.399 81.952 200.363 92.646 L 176.691 120.658 Q 170.882 127.532 171.541 136.508 L 174.227 173.085 Q 175.252 187.048 162.290 181.758 L 128.333 167.901 Q 120.000 164.500 111.667 167.901 L 77.710 181.758 Q 64.748 187.048 65.773 173.085 L 68.459 136.508 Q 69.118 127.532 63.309 120.658 L 39.637 92.646 Q 30.601 81.952 44.197 78.613 L 79.813 69.864 Q 88.553 67.718 93.296 60.069 Z" fill="url(#__ID__-sheen)" stroke="#fff" stroke-width=".65" stroke-opacity=".20"/>`,
    },
  },
];

export const DEFAULT_AGENT_STYLE_ID = AGENT_STYLES[0].id;

/** Estilo pelo id salvo, com fallback para o primeiro do catalogo. */
export function getAgentStyle(id?: string | null): AgentStyle {
  return AGENT_STYLES.find((style) => style.id === id) ?? AGENT_STYLES[0];
}

/** Ids validos, para validar o que chega do banco antes de gravar. */
export const AGENT_STYLE_IDS = AGENT_STYLES.map((style) => style.id);

/** True quando o id existe no catalogo. */
export function isAgentStyleId(id?: string | null): boolean {
  return typeof id === 'string' && AGENT_STYLE_IDS.includes(id);
}
