import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import './StyledSelect.css'
import type { ReactNode } from 'react'

type SelectValue = string | number

export interface StyledSelectOption<T extends SelectValue> {
  value: T
  label: ReactNode
  description?: ReactNode
  hint?: string
}

interface StyledSelectProps<T extends SelectValue> {
  value: T
  options: StyledSelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  compact?: boolean
}

export default function StyledSelect<T extends SelectValue>({
  value,
  options,
  onChange,
  placeholder,
  className,
  disabled = false,
  compact = false
}: StyledSelectProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listboxRef = useRef<HTMLUListElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  )

  useEffect(() => {
    if (selectedIndex >= 0) {
      setHighlightedIndex(selectedIndex)
    }
  }, [selectedIndex, isOpen])

  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggleDropdown = useCallback(() => {
    if (disabled) return
    setIsOpen((prev) => !prev)
  }, [disabled])

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!isOpen) return
      const node = containerRef.current
      if (node && !node.contains(event.target as Node)) {
        closeDropdown()
      }
    },
    [isOpen, closeDropdown]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdown()
      }
    },
    [isOpen, closeDropdown]
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClickOutside, handleKeyDown])

  const commitChange = useCallback(
    (nextValue: T) => {
      onChange(nextValue)
      closeDropdown()
      requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    },
    [closeDropdown, onChange]
  )

  const handleOptionClick = useCallback(
    (option: StyledSelectOption<T>) => {
      if (option.value === value) {
        closeDropdown()
        return
      }
      commitChange(option.value)
    },
    [commitChange, closeDropdown, value]
  )

  const scrollIntoView = useCallback(
    (index: number) => {
      const listbox = listboxRef.current
      if (!listbox) return
      const optionNode = listbox.children[index] as HTMLElement | undefined
      if (!optionNode) return
      const optionTop = optionNode.offsetTop
      const optionBottom = optionTop + optionNode.offsetHeight
      const viewTop = listbox.scrollTop
      const viewBottom = viewTop + listbox.clientHeight
      if (optionTop < viewTop) {
        listbox.scrollTop = optionTop
      } else if (optionBottom > viewBottom) {
        listbox.scrollTop = optionBottom - listbox.clientHeight
      }
    },
    []
  )

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        toggleDropdown()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          return
        }
        setHighlightedIndex((index) => {
          const nextIndex = Math.min(options.length - 1, index + 1)
          scrollIntoView(nextIndex)
          return nextIndex
        })
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          return
        }
        setHighlightedIndex((index) => {
          const nextIndex = Math.max(0, index - 1)
          scrollIntoView(nextIndex)
          return nextIndex
        })
      }

      if (event.key === 'Home') {
        event.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        }
        scrollIntoView(0)
        setHighlightedIndex(0)
      }

      if (event.key === 'End') {
        event.preventDefault()
        const lastIndex = Math.max(0, options.length - 1)
        if (!isOpen) {
          setIsOpen(true)
        }
        scrollIntoView(lastIndex)
        setHighlightedIndex(lastIndex)
      }

      if (event.key === 'Tab') {
        closeDropdown()
      }

      if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
        event.preventDefault()
        const highlightedOption = options[highlightedIndex]
        if (highlightedOption) {
          commitChange(highlightedOption.value)
        }
      }
    },
    [disabled, toggleDropdown, isOpen, options, highlightedIndex, commitChange, closeDropdown, scrollIntoView]
  )

  const handleOptionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLLIElement>, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const option = options[index]
        if (option) {
          commitChange(option.value)
        }
      }
    },
    [commitChange, options]
  )

  return (
    <div
      ref={containerRef}
      className={clsx(
        'styled-select',
        className,
        {
          'styled-select--open': isOpen,
          'styled-select--disabled': disabled,
          'styled-select--compact': compact
        }
      )}
      data-selected-label={selectedOption ? String(selectedOption.label) : ''}
      style={compact ? { minWidth: 130 } : undefined}
    >
      <button
        type="button"
        ref={triggerRef}
        className="styled-select-trigger"
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="styled-select-value">
          {selectedOption ? selectedOption.label : placeholder ?? '请选择'}
        </span>
        <span className="styled-select-icon" aria-hidden="true">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 3L7 9L13 3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <ul
        ref={listboxRef}
        className="styled-select-dropdown"
        role="listbox"
        tabIndex={-1}
        aria-activedescendant={highlightedIndex >= 0 ? `styled-select-option-${String(options[highlightedIndex]?.value)}` : undefined}
        hidden={!isOpen}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value
          const isHighlighted = index === highlightedIndex
          return (
            <li
              key={String(option.value)}
              id={`styled-select-option-${String(option.value)}`}
              role="option"
              aria-selected={isSelected}
              className={clsx('styled-select-option', {
                'styled-select-option--selected': isSelected,
                'styled-select-option--highlighted': isHighlighted
              })}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleOptionClick(option)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              tabIndex={-1}
            >
              <span className="styled-select-option-label">{option.label}</span>
              {option.description ? (
                <span className="styled-select-option-description">{option.description}</span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

