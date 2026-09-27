import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title = 'Noktayı Sil',
  itemName,
  description = 'Bu işlem kalıcıdır ve geri alınamaz.',
  confirmText = 'Evet, Sil',
  cancelText = 'Vazgeç',
  isDeleting = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="delete-confirm-overlay"
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="delete-confirm-modal"
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
            </div>
            <button
              id="delete-confirm-close-btn"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {itemName && (
            <div className="my-3 p-3 bg-red-50/70 border border-red-100 rounded-xl text-xs text-slate-800 font-medium">
              <span className="text-red-700 font-semibold block mb-0.5">Silinecek Öğe:</span>
              <span className="font-bold text-slate-900 break-words">{itemName}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100">
            <button
              id="delete-confirm-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              id="delete-confirm-submit-btn"
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Siliniyor...' : confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
