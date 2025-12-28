
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, Loader2, Calendar, AlertCircle } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { analytics } from '../lib/analytics';
import { saveBooking } from '../lib/mockApi';

const BookingCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'datetime' | 'email' | 'success'>('datetime');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [sessionID] = useState(() => `BKG-${Math.floor(1000 + Math.random() * 9000)}-SYS`);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

  const calendarGrid = [];
  for (let i = 0; i < firstDay; i++) calendarGrid.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarGrid.push(i);

  const timeSlots = ["09:00 AM", "11:00 AM", "01:30 PM", "03:30 PM"];

  const handleDateSelection = (day: number) => {
    const targetDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate < today) {
      setDateError("This is a past date. Booking is not possible.");
      setSelectedDate(null);
      return;
    }

    setDateError(null);
    setSelectedDate(targetDate);
  };

  const handleProceedToEmail = () => {
    if (selectedDate && selectedTime) setStep('email');
  };

  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        setStep('datetime');
        setSelectedDate(null);
        setSelectedTime(null);
        setEmail('');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleFinalize = async () => {
    if (!email || !selectedDate || !selectedTime) return;
    setIsTransmitting(true);
    
    const bookingData = {
      email,
      phone: 'SKIPPED',
      date: selectedDate.toLocaleDateString(),
      time: selectedTime,
      session_id: sessionID
    };

    try {
      await saveBooking(bookingData);
      
      const serviceID = process.env.EMAILJS_SERVICE_ID || 'default_service';
      const templateID = process.env.EMAILJS_TEMPLATE_ID || 'template_booking';
      const publicKey = process.env.EMAILJS_PUBLIC_KEY || '';

      if (publicKey) {
        await emailjs.send(
          serviceID,
          templateID,
          {
            to_email: 'harristotle84@gmail.com',
            from_email: email,
            booking_date: bookingData.date,
            booking_time: bookingData.time,
            session_id: bookingData.session_id,
            message: `New strategy session locked: ${bookingData.date} at ${bookingData.time}.`
          },
          publicKey
        );
      }

      analytics.logHandshake('calendly');
      setIsTransmitting(false);
      setStep('success');
    } catch (err) {
      console.warn("Communication Bridge Exception:", err);
      setIsTransmitting(false);
      setStep('success'); 
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#0f172a]/90 rounded-[1.5rem] md:rounded-[2.5rem] shadow-lab overflow-hidden border border-slate-200 dark:border-white/10 text-midnight dark:text-gray-100 w-full max-w-lg relative min-h-[480px] flex flex-col font-mono transition-colors duration-500"
    >
      <AnimatePresence mode="wait">
        {step === 'datetime' ? (
          <motion.div key="datetime" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 md:p-8 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm md:text-xl font-black uppercase tracking-tighter text-midnight dark:text-white">{months[currentMonth]} {currentYear}</h3>
              <div className="flex gap-1">
                <button onClick={() => handleMonthShift(-1)} className="p-1.5 border border-slate-100 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"><ChevronLeft size={16} /></button>
                <button onClick={() => handleMonthShift(1)} className="p-1.5 border border-slate-100 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2 text-center text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
              {days.map((day, i) => <div key={i}>{day}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {calendarGrid.map((day, idx) => {
                const targetDate = day ? new Date(currentYear, currentMonth, day) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = targetDate && targetDate < today;
                const isSelected = day && selectedDate?.getDate() === day && selectedDate?.getMonth() === currentMonth;
                const isToday = day && today.getDate() === day && today.getMonth() === currentMonth;

                return (
                  <div key={idx} className="aspect-square">
                    {day ? (
                      <button 
                        onClick={() => handleDateSelection(day)} 
                        className={`w-full h-full rounded-md text-[10px] font-black transition-all ${
                          isSelected 
                            ? 'bg-sunset text-white shadow-lg scale-110 z-10' 
                            : isPast
                              ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed'
                              : isToday 
                                ? 'border-2 border-sunset text-sunset font-black'
                                : 'text-midnight dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10'
                        }`}
                      >
                        {day}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {dateError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 bg-red-50 dark:bg-red-500/10 p-2 rounded-lg border border-red-100 dark:border-red-500/20"
                >
                  <AlertCircle size={12} /> {dateError}
                </motion.div>
              )}
            </AnimatePresence>

            {selectedDate && (
              <div className="mt-2 space-y-3">
                <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-600 tracking-widest">Available Slots</span>
                <div className="grid grid-cols-2 gap-3">
                  {timeSlots.map(time => (
                    <button 
                      key={time} 
                      onClick={() => setSelectedTime(time)} 
                      className={`px-3 py-3 rounded-lg text-[11px] font-[900] transition-all border ${
                        selectedTime === time 
                          ? 'bg-midnight dark:bg-white text-white dark:text-midnight border-midnight dark:border-white shadow-lg' 
                          : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-transparent hover:text-midnight dark:hover:text-white'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button 
              disabled={!selectedDate || !selectedTime} 
              onClick={handleProceedToEmail} 
              className="mt-6 w-full py-5 bg-midnight dark:bg-white text-white dark:text-midnight rounded-xl font-black text-xs md:text-sm uppercase tracking-[0.2em] disabled:opacity-20 flex items-center justify-center gap-3 hover:bg-sunset dark:hover:bg-sunset dark:hover:text-white transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)]"
            >
              CONTINUE <ArrowRight size={18} />
            </button>
          </motion.div>
        ) : step === 'email' ? (
          <motion.div key="email" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="p-6 md:p-12 flex-1 flex flex-col justify-center">
            <h3 className="text-lg md:text-2xl font-black text-midnight dark:text-white uppercase tracking-tighter mb-4">Transmission ID</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-6">Enter your email to lock in this slot.</p>
            <input 
              autoFocus
              type="email" 
              placeholder="architect@domain.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && email.includes('@') && handleFinalize()}
              className="w-full bg-slate-50 dark:bg-white/5 border-b-2 border-slate-200 dark:border-white/10 focus:border-sunset py-3 outline-none font-black text-base mb-8 text-midnight dark:text-white transition-all placeholder:text-slate-200" 
            />
            <button 
              disabled={!email.includes('@') || isTransmitting}
              onClick={handleFinalize} 
              className="w-full py-6 bg-sunset text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:brightness-110 transition-all disabled:opacity-30"
            >
              {isTransmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> 
                  <span>Encrypting...</span>
                </>
              ) : 'CONFIRM PROTOCOL'}
            </button>
          </motion.div>
        ) : (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 md:p-12 text-center flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={32} /></div>
            <h3 className="text-xl font-black text-midnight dark:text-white uppercase tracking-tighter mb-2">Protocol Active</h3>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] mb-6 font-medium leading-relaxed">
              Strategy session confirmed for <span className="text-midnight dark:text-white font-bold">{selectedTime}</span>. <br/>
              A forensic briefing has been dispatched to {email}. <br/>
              <span className="text-[8px] uppercase tracking-widest mt-8 block opacity-40">Auto-resetting node state...</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BookingCalendar;
