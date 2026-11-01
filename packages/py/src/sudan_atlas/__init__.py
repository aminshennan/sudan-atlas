"""Sudan Atlas: official codes, names and boundaries for Sudan's states and localities.

    >>> from sudan_atlas import match, get_states, get_localities, get_feature
    >>> match("El Fasher", level=2)["pcode"]
    'SD02114'
"""

from .match import Matcher, match
from .places import RESOLUTIONS, data_version, get_feature, get_localities, get_states

__version__ = "0.1.1"
DATA_VERSION = data_version()

__all__ = ["DATA_VERSION", "RESOLUTIONS", "Matcher", "get_feature", "get_localities", "get_states", "match"]
