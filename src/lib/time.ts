import { formatDistanceToNow } from 'date-fns';

/**
 * Converts a database UTC timestamp to a relative string (e.g., "5m ago")
 */
export function formatRelativeTime(timestamp: string | Date) {
  try {
    let dateStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
    
    // Normalize to UTC
    if (typeof timestamp === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Just now';

    // standard relative time comparison
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return 'Just now';
  }
}

/**
 * Formats a timestamp to Pakistan Local Time (e.g., "03:35 PM")
 */
export function formatLocalTime(timestamp: string | Date) {
  try {
    let dateStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
    
    if (typeof timestamp === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }

    const date = new Date(dateStr);
    
    // Always format to Karachi time
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true,
      timeZone: 'Asia/Karachi' 
    });
  } catch (e) {
    return '--:--';
  }
}
