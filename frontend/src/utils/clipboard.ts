/**
 * Утилита надежного копирования текста в буфер обмена.
 * Работает как в защищенном HTTPS контексте, так и при прямом доступе по HTTP (по IP-адресу VPS).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  // 1. Попытка через современный Clipboard API (работает только в HTTPS или localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText error, fallback to execCommand:', err)
    }
  }

  // 2. Fallback через document.execCommand('copy') — работает на обычных HTTP IP-адресах
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text

    // Скрываем элемент из поля видимости, но сохраняем его в DOM для вызова copy
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    textArea.style.opacity = '0'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    // Для мобильных устройств iOS / Safari
    textArea.setSelectionRange(0, textArea.value.length)

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (successful) {
      return true
    }
  } catch (err) {
    console.warn('[Clipboard] execCommand failed:', err)
  }

  // 3. Крайний fallback: диалоговое окно prompt для ручного копирования
  try {
    window.prompt('Скопируйте ссылку вручную (Ctrl+C / Cmd+C):', text)
    return true
  } catch {
    return false
  }
}
