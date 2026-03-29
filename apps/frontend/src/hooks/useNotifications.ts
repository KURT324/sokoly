import { useEffect, useRef } from 'react';
import { useSocketEvent } from './useSocket';

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification(title: string, body: string, url?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: '/favicon.ico' });
  if (url) n.onclick = () => { window.focus(); window.location.href = url; };
}

export function useNotifications() {
  useEffect(() => { requestNotificationPermission(); }, []);

  useSocketEvent<{ dayId: string; dayNumber: number; cohortId: string }>('notify:day_opened', (data) => {
    showNotification('Новый учебный день', `День ${data.dayNumber} открыт!`, '/student/dashboard');
  });

  useSocketEvent<{ taskId: string; status: string; comment?: string }>('notify:card_reviewed', (data) => {
    const text = data.status === 'COMPLETED'
      ? 'Задание выполнено правильно!'
      : `Задание возвращено: ${data.comment ?? ''}`;
    showNotification('Проверка карточки', text, '/student/cards');
  });

  useSocketEvent<{ testId: string; score: number }>('notify:test_graded', (data) => {
    showNotification('Тест проверен', `Ваш балл: ${data.score.toFixed(0)}`, '/student/dashboard');
  });
}
