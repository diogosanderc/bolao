export default function ManutencaoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-950">
      <div className="space-y-6 max-w-sm">
        <div className="flex justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00bf63"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-20 h-20"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Em Manutenção</h1>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            O Bolão Copa 2026 está passando por melhorias e voltará em breve.
          </p>
        </div>

        <div className="w-12 h-1 rounded-full bg-[#00bf63] mx-auto" />

        <p className="text-xs text-gray-600">
          Obrigado pela paciência!
        </p>
      </div>
    </div>
  )
}
