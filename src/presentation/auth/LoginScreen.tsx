import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, User } from '../../data/database';
import { useAuthStore } from './store/useAuthStore';
import { User as UserIcon, Lock, ChevronRight, Delete } from 'lucide-react';
import { cn } from '../../core/utils/cn';

export function LoginScreen() {
  const { login } = useAuthStore();
  const users = useLiveQuery(() => db.users.toArray()) || [];
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Admin creation state
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');

  const handlePinInput = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  useEffect(() => {
    if (pin.length === 4 && selectedUser) {
      if (pin === selectedUser.pinHash) { // In a real app, hash the PIN
        login(selectedUser);
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    }
  }, [pin, selectedUser, login]);

  const handleCreateAdmin = async () => {
    if (!adminName.trim() || adminPin.length !== 4) {
      setError('Please enter a valid name and 4-digit PIN');
      return;
    }
    const newUser: User = {
      name: adminName.trim(),
      role: 'Admin',
      pinHash: adminPin,
      createdAt: new Date()
    };
    await db.users.add(newUser);
    login(newUser);
  };

  if (users.length === 0) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#F2F2F7] p-4">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <img
                src="/ezyinvoicelogo.png"   // your logo path
                alt="Company Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
          <h1 className="text-2xl font-bold mb-2 text-[#1C1C1E]">Welcome to EzyPOS</h1>
          <p className="text-[#6E6E73] mb-8">Create your admin account to get started.</p>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">Your Name</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none tracking-[0.5em] font-mono text-lg"
                placeholder="••••"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleCreateAdmin}
              className="w-full bg-[#007AFF] text-white font-semibold py-3.5 rounded-xl hover:bg-[#007AFF]/90 transition-colors mt-4"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#F2F2F7] overflow-hidden">
      {/* Left side: User Selection */}
      <div className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 md:p-8 overflow-y-auto pb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#1C1C1E] mb-6 md:mb-8 mt-4 md:mt-0">Select User</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 max-w-2xl w-full">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => {
                setSelectedUser(user);
                setPin('');
                setError('');
              }}
              className={cn(
                "flex flex-col items-center p-4 md:p-6 rounded-2xl transition-all",
                selectedUser?.id === user.id 
                  ? "bg-[#007AFF] text-white shadow-lg scale-105" 
                  : "bg-white text-[#1C1C1E] hover:bg-gray-50 shadow-sm"
              )}
            >
              <div className={cn(
                "w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-2 md:mb-3",
                selectedUser?.id === user.id ? "bg-white/20" : "bg-[#F2F2F7]"
              )}>
                <UserIcon className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <span className="font-semibold text-base md:text-lg">{user.name}</span>
              <span className={cn(
                "text-[10px] md:text-xs mt-1 px-2 py-0.5 rounded-full",
                selectedUser?.id === user.id ? "bg-white/20" : "bg-gray-100 text-gray-500"
              )}>
                {user.role}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right side: PIN Pad */}
      <div className="w-full md:max-w-md bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.05)] md:shadow-[-10px_0_30px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center p-6 md:p-8 shrink-0 rounded-t-3xl md:rounded-none z-10 mt-auto md:mt-0 pb-safe">
        {selectedUser ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#1C1C1E] mb-2">Enter PIN</h2>
              <p className="text-[#6E6E73]">Welcome back, {selectedUser.name}</p>
            </div>

            {/* PIN Dots */}
            <div className="flex gap-4 mb-8">
              {[0, 1, 2, 3].map(i => (
                <div 
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-200",
                    i < pin.length ? "bg-[#007AFF] scale-110" : "bg-[#E3E3E8]"
                  )}
                />
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-4 animate-bounce">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handlePinInput(num.toString())}
                  className="w-full aspect-square rounded-full bg-[#F2F2F7] hover:bg-[#E3E3E8] text-2xl font-semibold text-[#1C1C1E] transition-colors flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <div /> {/* Empty space */}
              <button
                onClick={() => handlePinInput('0')}
                className="w-full aspect-square rounded-full bg-[#F2F2F7] hover:bg-[#E3E3E8] text-2xl font-semibold text-[#1C1C1E] transition-colors flex items-center justify-center"
              >
                0
              </button>
              <button
                onClick={handlePinDelete}
                className="w-full aspect-square rounded-full bg-[#F2F2F7] hover:bg-[#E3E3E8] text-[#1C1C1E] transition-colors flex items-center justify-center"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-[#6E6E73]">
            <Lock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Select a user to login</p>
          </div>
        )}
      </div>
    </div>
  );
}
