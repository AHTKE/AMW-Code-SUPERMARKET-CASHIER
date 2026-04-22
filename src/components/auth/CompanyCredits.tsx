import amwLogo from '@/assets/amw-logo.png';

const WHATSAPP_NUMBER = '201013318895';

const CompanyCredits = () => {
  const handleWhatsApp = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full max-w-sm mx-auto mt-6 pt-4 border-t border-border">
      <div className="bg-card/50 rounded-xl p-3 border border-border space-y-3">
        {/* Top row: logo + text */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleWhatsApp}
            className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-[#0a0a2e] flex items-center justify-center hover:opacity-90 transition-opacity active:scale-95"
            title="AMW Code Company"
            aria-label="AMW Code Company"
          >
            <img src={amwLogo} alt="AMW Code Company" className="w-full h-full object-cover" />
          </button>

          <div className="flex-1 text-right min-w-0">
            <p className="font-cairo text-[10px] text-muted-foreground leading-tight">
              Designed &amp; Developed by
            </p>
            <p className="font-cairo font-black text-[15px] text-foreground leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
              AMW Code Company
            </p>
            <p className="font-cairo text-[12px] text-muted-foreground leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
              Ahmed Mohamed Wahba
            </p>
          </div>
        </div>

        {/* WhatsApp full-width button below */}
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#25D366] hover:bg-[#1da851] transition-colors active:scale-[0.98] shadow-sm"
          title="تواصل عبر واتساب"
          aria-label="تواصل عبر واتساب"
        >
          {/* Official WhatsApp glyph */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            className="w-5 h-5"
            fill="white"
            aria-hidden="true"
          >
            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.493-.515 2.493-1.74 0-.157-.014-.31-.06-.46-.117-.345-1.846-1.05-2.103-1.05zM16 27.143A11.143 11.143 0 0 1 6.86 11.31L4.59 18.18l7.06-2.21A11.143 11.143 0 0 0 16 27.143zM16 4.857A11.143 11.143 0 0 1 27.143 16c0 6.155-4.988 11.143-11.143 11.143-1.79 0-3.557-.43-5.13-1.246l-.36-.215-5.733 1.79 1.82-5.575-.232-.358A11.087 11.087 0 0 1 4.857 16C4.857 9.845 9.845 4.857 16 4.857z"/>
          </svg>
          <span className="font-cairo text-sm font-bold text-white">
            تواصل معنا عبر واتساب
          </span>
        </button>
      </div>
    </div>
  );
};

export default CompanyCredits;
