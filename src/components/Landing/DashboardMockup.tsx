import { Search, Bell, Sparkles, Paperclip, Mic, ArrowUp, History, LayoutGrid } from 'lucide-react';

const DashboardMockup = () => {
  return (
    <div className="w-full h-full bg-[#0A1535] rounded-2xl overflow-hidden flex flex-col text-left select-none pointer-events-none">
      {/* Top bar */}
      <header className="h-12 border-b border-white/10 flex items-center px-5 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">e</div>
          <span className="text-white font-semibold text-[13px]">ellosuit</span>
        </div>

        <nav className="flex items-center gap-5 ml-6 text-[12px] text-white/60">
          <span className="text-white">Início</span>
          <span>Omni</span>
          <span>Flow</span>
          <span>Track</span>
          <span>Suite</span>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Search className="w-3.5 h-3.5 text-white/50" />
          <Bell className="w-3.5 h-3.5 text-white/50" />
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#374DA4] to-pink-500" />
        </div>
      </header>

      {/* Main area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative">
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(124,58,237,0.25) 0%, transparent 50%)',
          }}
        />

        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
          {/* Greeting */}
          <h1 className="text-white text-[28px] md:text-[34px] font-semibold tracking-tight text-center">
            Olá, Lucas <span className="inline-block">👋</span>
          </h1>
          <p className="text-white/50 text-[13px] mt-2 text-center">
            Como posso te ajudar hoje?
          </p>

          {/* Input pill */}
          <div className="w-full mt-7 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-3.5">
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
              <span className="flex-1 text-[13px] text-white/40">
                Pergunte qualquer coisa…
              </span>
              <Paperclip className="w-4 h-4 text-white/40" />
              <Mic className="w-4 h-4 text-white/40" />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <ArrowUp className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {[
              'Resuma minha agenda',
              'Crie uma tarefa',
              'Enviar e-mail',
              'Gerar proposta',
            ].map((t) => (
              <span
                key={t}
                className="text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1.5"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom dock */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
          <LayoutGrid className="w-3.5 h-3.5 text-white/50" />
          <div className="w-px h-3 bg-white/10" />
          <History className="w-3.5 h-3.5 text-white/50" />
          <span className="text-[10px] text-white/50">Histórico</span>
        </div>
      </main>
    </div>
  );
};

export default DashboardMockup;
