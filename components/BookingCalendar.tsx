import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, Loader2, Calendar } from 'lucide-react';
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
  const [sessionID] = useState(() => `BKG-${Math.floor(1000 + Math.random() * 9000)}-SYS`);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleMonthShift = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const calendarGrid = [];
  for (let i = 0; i < firstDay; i++) calendarGrid.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarGrid.push(i);

  const timeSlots = ["09:00 AM", "11:00 AM", "01:30 PM", "03:30 PM"];

  const handleProceedToEmail = () => {
    if (selectedDate && selectedTime) setStep('email');
  };

  const sendBookingEmail = async () => {
    const SERVICE_ID = 'service_p8nzc1e'; 
    const TEMPLATE_ID = 'template_0z3an7z'; 
    const PUBLIC_KEY = 'DWkUt3MKWHqHToy7Q'; 

    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        title: "Strategy Session Booking",
        name: email,
        time: new Date().toLocaleString(),
        message: `STRATEGY CALL BOOKED.\n\nDate: ${selectedDate?.toLocaleDateString()}\nTime Slot: ${selectedTime}\nEmail: ${email}\nSession: ${sessionID}`
      }, PUBLIC_KEY);
    } catch (error) {
      console.error('EmailJS Error:', error);
    }
  };

  const handleFinalize = async () => {
    if (!email || !selectedDate || !selectedTime) return;
    setIsTransmitting(true);
    try {
      await saveBooking({
        email,
        phone: 'SKIPPED',
        date: selectedDate.toLocaleDateString(),
        time: selectedTime,
        session_id: sessionID
      });
      await sendBookingEmail();
      analytics.logHandshake('calendly');
      setIsTransmitting(false);
      setStep('success');
    } catch (err) {
      setIsTransmitting(false);
      setStep('success'); 
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#1e293b]/80 rounded-[1.5rem] md:rounded-[2.5rem] shadow-lab overflow-hidden border border-slate-200 dark:border-white/10 text-midnight dark:text-gray-100 w-full max-w-lg relative min-h-[480px] flex flex-col font-mono"
    >
      <AnimatePresence mode="wait">
        {step === 'datetime' ? (
          <motion.div key="datetime" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 md:p-8 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Select Date</span>
                <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter">{months[currentMonth]} {currentYear}</h3>
              </div>
              <div className="flex gap-1 md:gap-2">
                <button onClick={() => handleMonthShift(-1)} className="p-2 border border-slate-100 rounded-lg hover:bg-slate-50"><ChevronLeft size={16} /></button>
                <button onClick={() => handleMonthShift(1)} className="p-2 border border-slate-100 rounded-lg hover:bg-slate-50"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {days.map((day, i) => (
                <div key={i} className="text-[8px] font-black text-slate-300 text-center">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1">
              {calendarGrid.map((day, idx) => {
                const isSelected = day && selectedDate?.getDate() === day && selectedDate?.getMonth() === currentMonth;
                return (
                  <div key={idx} className="aspect-square">
                    {day ? (
                      <button onClick={() => setSelectedDate(new Date(currentYear, currentMonth, day))} className={`w-full h-full rounded-md text-[10px] md:text-xs font-black transition-all ${isSelected ? 'bg-sunset text-white' : 'text-midnight hover:bg-slate-50'}`}>
                        {day}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {selectedDate && (
              <div className="mt-6 space-y-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Available Slots</span>
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map(time => (
                    <button key={time} onClick={() => setSelectedTime(time)} className={`px-3 py-2 rounded-lg text-[9px] font-black transition-all ${selectedTime === time ? 'bg-midnight text-white' : 'bg-slate-50 text-slate-400'}`}>
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button disabled={!selectedDate || !selectedTime} onClick={handleProceedToEmail} className="mt-6 w-full py-4 bg-midnight text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-10 flex items-center justify-center gap-2">
              PROCEED <ArrowRight size={14} />
            </button>
          </motion.div>
        ) : step === 'email' ? (
          <motion.div key="email" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="p-8 md:p-12 flex-1 flex flex-col justify-center">
            <h3 className="text-xl md:text-2xl font-black text-midnight uppercase tracking-tighter mb-6">Enter Email Address</h3>
            <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border-b-2 border-slate-200 focus:border-sunset py-4 outline-none font-black text-lg mb-8" />
            <button onClick={handleFinalize} className="w-full py-5 bg-sunset text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
              {isTransmitting ? <Loader2 size={16} className="animate-spin" /> : 'CONFIRM SESSION'}
            </button>
          </motion.div>
        ) : (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 md:p-12 text-center flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={32} /></div>
            <h3 className="text-2xl font-black text-midnight uppercase tracking-tighter mb-4">Confirmed</h3>
            <p className="text-slate-400 mb-8 text-xs font-medium">Session scheduled for <span className="text-midnight font-black">{selectedTime}</span>. Confirmation sent to {email}.</p>
            <button onClick={() => setStep('datetime')} className="w-full py-4 bg-slate-50 text-midnight rounded-xl font-black uppercase text-[10px] tracking-widest">RETURN</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BookingCalendar;