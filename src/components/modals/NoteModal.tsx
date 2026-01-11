import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { useState, useEffect, useRef } from 'react';
import { NoteResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';

interface NoteModalProps {
  open: boolean;
  onClose: () => void;
  babyId: string | undefined;
  initialTime: string;
  activity?: NoteResponse;
  /**
   * Optional variant to control the modal styling
   */
  variant?: 'note' | 'default';
}

export default function NoteModal({
  open,
  onClose,
  babyId,
  initialTime,
  activity,
  variant = 'default',
}: NoteModalProps) {
  const { t } = useLocalization();
  const [formData, setFormData] = useState({
    time: initialTime,
    content: '',
    category: '',
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter categories based on input
  const filteredCategories = categories.filter(category =>
    category.toLowerCase().includes(formData.category.toLowerCase())
  );

  useEffect(() => {
    // Fetch existing categories
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/note?categories=true');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        if (data.success) {
          setCategories(data.data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (open) {
      fetchCategories();
    }
  }, [open]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset selected index when input changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [formData.category]);

  // Format date string to be compatible with datetime-local input
  const formatDateForInput = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    // Format as YYYY-MM-DDThh:mm in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (open) {
      if (activity) {
        // Editing mode - populate with activity data
        setFormData({
          time: formatDateForInput(initialTime),
          content: activity.content,
          category: activity.category || '',
        });
      } else {
        // New entry mode
        setFormData(prev => ({
          ...prev,
          time: formatDateForInput(initialTime)
        }));
      }
    }
  }, [open, initialTime, activity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyId) return;

    // Validate required fields
    if (!formData.content || !formData.time) {
      console.error('Required fields missing');
      return;
    }

    try {
      const payload = {
        babyId,
        time: formData.time,
        content: formData.content,
        category: formData.category || null,
      };

      const response = await fetch(`/api/note${activity ? `?id=${activity.id}` : ''}`, {
        method: activity ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      onClose();
      
      // Reset form data
      setFormData({
        time: initialTime,
        content: '',
        category: '',
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="dialog-content !p-4 sm:!p-6">
        <DialogHeader className="dialog-header">
          <DialogTitle className="dialog-title">
            {activity ? 'Edit Note' : 'Add Note'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {activity ? 'Update your note about your baby' : 'Record a note about your baby'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t('Time')}</label>
                <Input
                  type="datetime-local"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                  className="w-full"
                  required
                  tabIndex={-1}
                />
              </div>
              <div>
                <label className="form-label">{t('Category')}</label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    value={formData.category}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, category: value });
                      setShowDropdown(true);
                    }}
                    className="w-full"
                    placeholder="Type or select a category"
                    onKeyDown={(e) => {
                      const visibleCategories = categories.filter(category =>
                        category.toLowerCase().includes(formData.category.toLowerCase())
                      );

                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedIndex(prev => 
                          Math.min(prev + 1, visibleCategories.length - 1)
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedIndex(prev => Math.max(prev - 1, -1));
                      } else if (e.key === 'Enter' && selectedIndex !== -1) {
                        e.preventDefault();
                        setFormData({ ...formData, category: visibleCategories[selectedIndex] });
                        setShowDropdown(false);
                      } else if (e.key === 'Escape') {
                        setShowDropdown(false);
                      }
                    }}
                  />
                  {/* Suggestions dropdown */}
                  {showDropdown && formData.category && categories.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-48 overflow-auto"
                    >
                      {(filteredCategories.length > 0 ? filteredCategories : categories).map((category, index) => (
                        <div
                          key={category}
                          className={`px-3 py-2 cursor-pointer ${
                            index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setFormData({ ...formData, category });
                            setShowDropdown(false);
                          }}
                        >
                          {category}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="form-label">{t('Note Content')}</label>
              <Textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full min-h-[100px] resize-none"
                placeholder="Enter your note here..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:justify-end gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="hover:bg-slate-50"
            >
              {t('Cancel')}
            </Button>
            <Button 
              type="submit"
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700"
            >
              {activity ? 'Update Note' : 'Save Note'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
