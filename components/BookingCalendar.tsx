import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { analytics } from '../lib/analytics';
import { saveBooking, fetchTakenSlots } from '../lib/api';
import { ChevronLeft, ChevronRight, Check, Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';

const BookingCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [step, setStep] = useState<'datetime' | 'email' | 'success'>('datetime');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [sessionID] = useState(() => `BKG-${Math.floor(1000 + Math.random() * 9000)}-SYS`);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleMonthShift = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    setDateError(null);
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const calendarGrid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarGrid.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarGrid.push(i);

  const timeSlots = ['09:00 AM', '11:00 AM', '01:30 PM', '03:30 PM', '05:00 PM'];

  const handleDateSelection = (day: number) => {
    const targetDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate < today) {
      setDateError('Selected date is in the past. Please choose an upcoming date.');
      setSelectedDate(null);
      return;
    }

    setDateError(null);
    setSelectedDate(targetDate);
    setSelectedTime(null);
  };

  const formatDateYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    let isMounted = true;
    const loadTakenSlots = async () => {
      if (!selectedDate) {
        if (isMounted) setTakenSlots([]);
        return;
      }
      try {
        const slots = await fetchTakenSlots(formatDateYYYYMMDD(selectedDate));
        if (isMounted) {
          setTakenSlots(slots || []);
        }
      } catch {
        if (isMounted) setTakenSlots([]);
      }
    };
    loadTakenSlots();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedDate || !selectedTime) return;
    setIsTransmitting(true);
    setDateError(null);

    const bookingData = {
      email: email.trim(),
      name: clientName.trim() || 'Valued Client',
      phone: 'SKIPPED',
      date: formatDateYYYYMMDD(selectedDate),
      time: selectedTime,
      session_id: sessionID,
    };

    try {
      await saveBooking(bookingData);

      const serviceID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'default service';
      const templateID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template booking';
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

      if (publicKey) {
        await emailjs.send(
          serviceID,
          templateID,
          {
            to_email: 'harristotle84@gmail.com',
            from_email: email,
            client_name: bookingData.name,
            booking_date: bookingData.date,
            booking_time: bookingData.time,
            session_id: bookingData.session_id,
            message: `Strategy Consultation Booked: ${bookingData.date} at ${bookingData.time}.`,
          },
          publicKey
        );
      }

      analytics.logHandshake('calendly');
      setIsTransmitting(false);
      setStep('success');
    } catch (err: any) {
      console.warn('Booking Exception:', err);
      setIsTransmitting(false);
      if (err.message && err.message.includes('taken')) {
        setDateError('This time slot was just booked by another client. Please select an alternate slot.');
        setStep('datetime');
        const slots = await fetchTakenSlots(formatDateYYYYMMDD(selectedDate));
        setTakenSlots(slots || []);
      } else {
        setDateError('Unable to confirm booking. Please try again or reach out directly.');
        setStep('datetime');
      }
    }
  };

  if (step === 'success') {
    return (
      <div className="p-8 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] text-center max-w-md w-full">
        <div className="w-10 h-10 rounded-lg bg-[#111315] border border-[#30363B] text-[#C58A52] flex items-center justify-center mx-auto mb-4">
          <Check size={20} />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED] mb-2">
          Consultation Confirmed
        </h3>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-4">
          Your strategy session has been scheduled for{' '}
          <span className="font-semibold text-slate-900 dark:text-[#F2F1ED]">
            {selectedDate?.toLocaleDateString()} at {selectedTime}
          </span>
          . Confirmation details will be sent to{' '}
          <span className="font-semibold text-slate-900 dark:text-[#F2F1ED]">{email}</span>.
        </p>

        <div className="font-mono text-[11px] text-slate-500 dark:text-[#747C84] mb-6">
          Booking Reference: <span className="text-[#C58A52] font-semibold">{sessionID}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setStep('datetime');
            setSelectedDate(null);
            setSelectedTime(null);
            setEmail('');
            setClientName('');
          }}
          className="w-full min-h-[44px] py-2.5 px-4 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-md transition-colors"
        >
          Book Another Session
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-7 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] w-full max-w-md">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-[#30363B]">
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} className="text-[#C58A52]" aria-hidden="true" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider">
            {step === 'datetime' ? 'Select Date & Time' : 'Your Contact Details'}
          </h3>
        </div>
        <div className="text-[11px] font-mono text-slate-500 dark:text-[#747C84]">
          {step === 'datetime' ? '01 / 02' : '02 / 02'}
        </div>
      </div>

      {dateError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs">
          {dateError}
        </div>
      )}

      {step === 'datetime' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-[#F2F1ED]">
              {months[currentMonth]} {currentYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMonthShift(-1)}
                className="w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleMonthShift(1)}
                className="w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-slate-500 dark:text-[#747C84]">
            {days.map((d, dIdx) => (
              <div key={`day-hdr-${d}-${dIdx}`} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${currentYear}-${currentMonth}-${idx}`} className="h-9" />;
              }

              const dateObj = new Date(currentYear, currentMonth, day);
              const isSelected = selectedDate?.toDateString() === dateObj.toDateString();
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isPast = dateObj < today;

              return (
                <button
                  key={`cal-day-${currentYear}-${currentMonth}-${day}`}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDateSelection(day)}
                  aria-label={`${months[currentMonth]} ${day}, ${currentYear}`}
                  className={`h-9 rounded-md text-xs font-mono tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52] ${
                    isSelected
                      ? 'bg-[#C58A52] text-[#111315] font-bold'
                      : isPast
                        ? 'text-slate-300 dark:text-[#30363B] cursor-not-allowed'
                        : 'text-slate-700 dark:text-[#A3A9AF] hover:bg-slate-100 dark:hover:bg-[#202428] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="pt-3 border-t border-slate-100 dark:border-[#30363B] space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-[#A3A9AF] flex items-center gap-1.5">
                <Clock size={12} className="text-[#C58A52]" aria-hidden="true" />
                <span>Available times for {selectedDate.toLocaleDateString()}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timeSlots.map((slot, sIdx) => {
                  const isTaken = takenSlots.includes(slot);
                  const isSelected = selectedTime === slot;

                  return (
                    <button
                      key={`slot-${sIdx}-${slot.replace(/[:\s]/g, '-')}`}
                      type="button"
                      disabled={isTaken}
                      onClick={() => setSelectedTime(slot)}
                      className={`min-h-[38px] py-1.5 px-2 rounded-md text-xs font-mono tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52] ${
                        isSelected
                          ? 'bg-[#C58A52] text-[#111315] font-bold'
                          : isTaken
                            ? 'bg-slate-100 dark:bg-[#111315] text-slate-400 dark:text-[#30363B] cursor-not-allowed line-through'
                            : 'border border-slate-200 dark:border-[#30363B] hover:border-[#C58A52]/60 text-slate-700 dark:text-[#A3A9AF]'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep('email')}
              className="w-full min-h-[44px] py-2.5 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-md transition-colors"
            >
              Continue to Details
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFinalize} className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111315] border border-slate-200 dark:border-[#30363B] text-xs space-y-1 font-mono">
            <div className="text-slate-500 dark:text-[#747C84]">Selected Consultation Slot:</div>
            <div className="font-bold text-slate-900 dark:text-[#F2F1ED]">
              {selectedDate?.toLocaleDateString()} at {selectedTime}
            </div>
          </div>

          <div>
            <label
              htmlFor="booking-client-name"
              className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5"
            >
              Your Name
            </label>
            <input
              id="booking-client-name"
              type="text"
              required
              autoComplete="name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full px-3.5 py-2.5 rounded-md border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-base sm:text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="booking-client-email"
              className="block text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] mb-1.5"
            >
              Business Email Address
            </label>
            <input
              id="booking-client-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-2.5 rounded-md border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] text-base sm:text-xs placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2 gap-3">
            <button
              type="button"
              onClick={() => setStep('datetime')}
              className="min-h-[40px] px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-[#F2F1ED] transition-colors"
            >
              Back to Date
            </button>

            <button
              type="submit"
              disabled={isTransmitting}
              className="min-h-[44px] px-5 py-2.5 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-md transition-colors inline-flex items-center gap-1.5"
            >
              {isTransmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <span>Confirm Booking</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BookingCalendar;
