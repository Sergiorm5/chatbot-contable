"use client";

type ModalProps = {
  onClose: () => void;
  onSelectRFC: (rfc: string) => void;
};

export default function Modal({ onClose, onSelectRFC }: ModalProps) {
  const rfcList = ["AELB5401024Q7"];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-6 w-96 animate-fadeIn">
        <h2 className="text-xl font-semibold mb-5 text-center">
          Selecciona un RFC
        </h2>
        <ul className="space-y-3">
          {rfcList.map((rfc) => (
            <li key={rfc}>
              <button
                onClick={() => onSelectRFC(rfc)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl hover:bg-indigo-600 transition-colors duration-200 text-left font-medium"
              >
                {rfc}
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-red-600 hover:bg-red-700 transition-colors duration-200 text-white font-semibold px-4 py-3 rounded-xl"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
