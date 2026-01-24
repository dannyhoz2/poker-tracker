'use client'

import { Fragment, ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="relative z-10 w-full max-w-md transform rounded-2xl bg-gray-800 p-6 shadow-xl transition-all">
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
