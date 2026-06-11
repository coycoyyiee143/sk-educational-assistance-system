# app/core/models.py
from dataclasses import dataclass, field
from typing import Optional, Dict

@dataclass
class OcrBlock:
    text: str
    confidence: float
    x_min: float
    y_min: float
    x_max: float
    y_max: float

    @property
    def x_center(self): return (self.x_min + self.x_max) / 2
    @property
    def y_center(self): return (self.y_min + self.y_max) / 2
    @property
    def width(self): return self.x_max - self.x_min
    @property
    def height(self): return self.y_max - self.y_min

@dataclass
class ExtractionResult:
    value: Optional[str]
    raw: Optional[str]
    method: str
    confidence: float
    context: str
    found: bool = True
    metadata: Dict = field(default_factory=dict)