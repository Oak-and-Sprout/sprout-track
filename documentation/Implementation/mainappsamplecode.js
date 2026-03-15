import React, { useState } from 'react';

// Placeholder for icons - these would come from your chosen icon library
const IconPlaceholder = ({ name, className }) => (
  <div className={`inline-flex items-center justify-center ${className}`}>
    {name}
  </div>
);

const BabyTracker = () => {
  // State management
  const [selectedBaby, setSelectedBaby] = useState(null);
  const [showBabyModal, setShowBabyModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showDiaperModal, setShowDiaperModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);

  // Sample data
  const babies = [
    { id: 1, name: "Emma", birthDate: "2023-08-15" },
    { id: 2, name: "Noah", birthDate: "2023-12-01" }
  ];

  // Basic modal component
  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  const BabyModal = () => (
    <Modal
      isOpen={showBabyModal}
      onClose={() => setShowBabyModal(false)}
      title={isEditing ? "Edit Baby" : "Add New Baby"}
    >
      <div className="space-y-4">
        <input
          type="text"
          placeholder="First Name"
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Last Name"
          className="w-full p-2 border rounded"
        />
        <input
          type="date"
          className="w-full p-2 border rounded"
        />
        <select className="w-full p-2 border rounded">
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <div className="flex justify-end space-x-2">
          <button 
            className="px-4 py-2 border rounded hover:bg-gray-100"
            onClick={() => setShowBabyModal(false)}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setShowBabyModal(false)}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );

  const QuickActionButton = ({ icon, label, onClick, active }) => (
    <button
      className={`flex flex-col items-center p-4 h-24 w-24 border rounded
        ${active ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
      onClick={onClick}
    >
      <IconPlaceholder name={icon} className="h-8 w-8 mb-2" />
      <span className="text-xs text-center">{label}</span>
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Top Bar with Baby Selector */}
      <div className="flex items-center space-x-4 bg-white p-4 rounded-lg shadow">
        <select 
          className="flex-grow p-2 border rounded"
          value={selectedBaby || ''}
          onChange={(e) => setSelectedBaby(e.target.value)}
        >
          <option value="">Select a baby</option>
          {babies.map(baby => (
            <option key={baby.id} value={baby.id}>
              {baby.name}
            </option>
          ))}
        </select>
        <button
          className="p-2 hover:bg-gray-100 rounded"
          onClick={() => {
            setIsEditing(true);
            setShowBabyModal(true);
          }}
        >
          <IconPlaceholder name="✎" className="h-5 w-5" />
        </button>
        <button
          className="p-2 hover:bg-gray-100 rounded"
          onClick={() => {
            setIsEditing(false);
            setShowBabyModal(true);
          }}
        >
          <IconPlaceholder name="+" className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickActionButton
          icon={isSleeping ? "☀️" : "🌙"}
          label={isSleeping ? "End Sleep" : "Start Sleep"}
          onClick={() => {
            setIsSleeping(!isSleeping);
            setShowSleepModal(true);
          }}
          active={isSleeping}
        />
        <QuickActionButton
          icon="🍼"
          label="Bottle"
          onClick={() => setShowFeedModal(true)}
        />
        <QuickActionButton
          icon="📝"
          label="Diaper"
          onClick={() => setShowDiaperModal(true)}
        />
        <QuickActionButton
          icon="⏰"
          label="Manual Entry"
          onClick={() => {/* Add manual entry logic */}}
        />
      </div>

      {/* Recent Activity Timeline */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <div className="space-y-2">
          {/* Sample timeline items */}
          <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
            <IconPlaceholder name="🌙" className="h-5 w-5 text-blue-500" />
            <div className="flex-grow">
              <p className="font-medium">Sleep</p>
              <p className="text-sm text-gray-500">2:30 PM - 4:30 PM</p>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <IconPlaceholder name="⋮" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
            <IconPlaceholder name="🍼" className="h-5 w-5 text-green-500" />
            <div className="flex-grow">
              <p className="font-medium">Bottle Feed</p>
              <p className="text-sm text-gray-500">2:00 PM - 120ml</p>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <IconPlaceholder name="⋮" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BabyModal />
      
    </div>
  );
};

export default BabyTracker;