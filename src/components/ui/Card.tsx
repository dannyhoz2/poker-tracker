'use client'

import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-gray-800 border border-gray-700',
      elevated: 'bg-gray-800 shadow-xl',
      outlined: 'bg-transparent border-2 border-gray-700',
    }

    return (
      <div
        ref={ref}
        className={`rounded-xl p-6 ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
