import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.utils.config import FEATURES, TARGET_MAPPING


def test_feature_list_not_empty():
    assert len(FEATURES) == 14


def test_target_mapping_covers_four_classes():
    assert set(TARGET_MAPPING.values()) == {0, 1, 2, 3}
