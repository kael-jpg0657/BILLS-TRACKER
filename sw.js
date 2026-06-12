// sw.js - Bill Tracker Service Worker
const CACHE_NAME = 'bill-tracker-v1';
let scheduledTimers = [];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Receive bill data from the page and schedule notifications
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleNotifications(data.bills || []);
  }
});

function scheduleNotifications(bills) {
  // Clear previously scheduled timers
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  bills.forEach(bill => {
    if (!bill.dueDate || bill.status === 'Paid') return;

    const dueDate = new Date(bill.dueDate + 'T09:00:00'); // 9 AM on due date
    const diffDays = Math.round((dueDate - now) / 86400000);

    // Notify if due today, tomorrow, or in 3 days
    const notifyDays = [3, 1, 0];

    notifyDays.forEach(days => {
      const notifyTime = new Date(dueDate);
      notifyTime.setDate(notifyTime.getDate() - days);
      notifyTime.setHours(9, 0, 0, 0);

      const delay = notifyTime - new Date();

      // Only schedule if in the future and within ~7 days (avoid huge setTimeout values)
      if (delay > 0 && delay < 7 * 86400000) {
        const timer = setTimeout(() => {
          showBillNotification(bill, days);
        }, delay);
        scheduledTimers.push(timer);
      }
    });
  });
}

function showBillNotification(bill, daysLeft) {
  let title, body;
  if (daysLeft === 0) {
    title = `⚠️ Due Today: ${bill.name}`;
    body = `Amount: ₱${Number(bill.amount).toLocaleString('en-PH')} — due today!`;
  } else if (daysLeft === 1) {
    title = `📅 ${bill.name} due tomorrow`;
    body = `Amount: ₱${Number(bill.amount).toLocaleString('en-PH')}`;
  } else {
    title = `📅 ${bill.name} due in ${daysLeft} days`;
    body = `Amount: ₱${Number(bill.amount).toLocaleString('en-PH')}`;
  }

  self.registration.showNotification(title, {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'bill-' + bill.id,
    renotify: true
  });
}

// Handle notification click - open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
